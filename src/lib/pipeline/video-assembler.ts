import { mkdir, unlink, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import ffmpeg from "fluent-ffmpeg";

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

/**
 * Substitui o MoviePy + Ken Burns do Python por FFmpeg puro.
 *
 * Estratégia:
 * - Para cada cena: probe da duração do áudio → render de um segmento MP4
 *   com efeito zoompan (Ken Burns), legenda opcional via drawtext, fadein/out.
 * - Concatena todos via `concat` demuxer.
 * - Mixa BGM com volume baixo via amix.
 *
 * Cada segmento é normalizado para o mesmo SAR/pix_fmt para garantir concat
 * funcionar sem reencode da concatenação final.
 */

function ffmpegBin(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

function ffprobeBin(): string {
  const base = ffmpegBin();
  if (base === "ffmpeg") return "ffprobe";
  return base.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
}

async function probeDuration(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobeBin(), [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      path,
    ]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(parseFloat(out.trim()));
      else reject(new Error(`ffprobe falhou (${code}): ${err}`));
    });
  });
}

function escapeForDrawtext(text: string): string {
  // FFmpeg drawtext exige escapes específicos
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\\\\\'")
    .replace(/"/g, '\\"')
    .replace(/%/g, "\\%");
}

interface RenderSceneOptions {
  imagePath: string;
  audioPath?: string;
  duration: number;
  text?: string;
  burnSubtitles: boolean;
  width: number;
  height: number;
  zoomDirection: "in" | "out";
  outPath: string;
  fps: number;
  fadeIn: number;
  fadeOut: number;
}

async function renderScene(opts: RenderSceneOptions): Promise<void> {
  const {
    imagePath,
    audioPath,
    duration,
    text,
    burnSubtitles,
    width,
    height,
    zoomDirection,
    outPath,
    fps,
    fadeIn,
    fadeOut,
  } = opts;

  const totalFrames = Math.max(1, Math.round(duration * fps));

  // Ken Burns via zoompan: zoom de 1.0→1.15 (in) ou 1.15→1.0 (out)
  // zoom é uma expressão por frame; on rampa linear.
  // x/y center for steady center pan.
  const zoomExpr =
    zoomDirection === "in"
      ? `1.0+(0.15*on/${totalFrames})`
      : `1.15-(0.15*on/${totalFrames})`;

  // Cover-fit: scale the source so it fills width×height (no letterbox).
  // Then crop. Resolution after scale = max(W, H*src_ar) x max(H, W/src_ar).
  // We do it inside the filter chain with force_original_aspect_ratio=increase.
  const baseFilter =
    `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,` +
    `crop=${width * 2}:${height * 2},` +
    `zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
    `d=${totalFrames}:s=${width}x${height}:fps=${fps},` +
    `format=yuv420p`;

  const fadeInFilter = fadeIn > 0 ? `,fade=t=in:st=0:d=${fadeIn.toFixed(2)}` : "";
  const fadeOutFilter =
    fadeOut > 0
      ? `,fade=t=out:st=${(duration - fadeOut).toFixed(2)}:d=${fadeOut.toFixed(2)}`
      : "";

  let drawText = "";
  if (burnSubtitles && text && text.trim()) {
    const escaped = escapeForDrawtext(text.trim());
    const fontsize = Math.max(34, Math.round(width * 0.027));
    // FFmpeg drawtext exige fontfile explícito quando fontconfig não está disponível
    // (Windows builds não vêm com fontconfig configurado). Drive letter precisa de
    // dupla escapação por causa do parser de filtros.
    const fontFile =
      process.env.FFMPEG_FONTFILE ?? "C\\:/Windows/Fonts/arial.ttf";
    drawText =
      `,drawtext=fontfile='${fontFile}':text='${escaped}':fontcolor=white:fontsize=${fontsize}:` +
      `borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.82:` +
      `line_spacing=8:box=0`;
  }

  const vfilter = `${baseFilter}${fadeInFilter}${fadeOutFilter}${drawText}`;

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
      .input(imagePath)
      .inputOptions([`-loop 1`, `-t ${duration.toFixed(3)}`]);

    if (audioPath) {
      cmd.input(audioPath);
    }

    cmd
      .videoFilters(vfilter)
      .outputOptions([
        "-pix_fmt yuv420p",
        `-r ${fps}`,
        "-c:v libx264",
        "-preset ultrafast",
        "-crf 23",
        "-shortest",
      ]);

    if (audioPath) {
      cmd.outputOptions(["-c:a aac", "-b:a 192k"]);
    } else {
      cmd.outputOptions(["-an"]);
    }

    cmd
      .on("error", (err, _stdout, stderr) =>
        reject(new Error(`ffmpeg renderScene: ${err.message}\n${stderr}`)),
      )
      .on("end", () => resolve())
      .save(outPath);
  });
}

function ensureDir(path: string) {
  return mkdir(path, { recursive: true });
}

interface AssembleNarratedOptions {
  imagePaths: string[];
  audioPaths: string[];
  narrations: string[];
  outPath: string;
  bgmPath?: string;
  burnSubtitles?: boolean;
  width?: number;
  height?: number;
  fps?: number;
}

export async function assembleNarrated({
  imagePaths,
  audioPaths,
  narrations,
  outPath,
  bgmPath,
  burnSubtitles = true,
  width = 1920,
  height = 1080,
  fps = 30,
}: AssembleNarratedOptions): Promise<string> {
  if (imagePaths.length !== audioPaths.length || imagePaths.length !== narrations.length) {
    throw new Error("Listas de imagens, áudios e narrações devem ter o mesmo tamanho");
  }

  await ensureDir(dirname(outPath));
  const workDir = join(tmpdir(), `tomada_${randomBytes(6).toString("hex")}`);
  await ensureDir(workDir);

  const segmentPaths: string[] = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const audioPath = audioPaths[i]!;
    const audioDur = await probeDuration(audioPath);
    const duration = Math.max(audioDur, 1.5);

    const segOut = join(workDir, `seg_${String(i).padStart(3, "0")}.mp4`);
    const direction: "in" | "out" = Math.random() < 0.5 ? "in" : "out";
    await renderScene({
      imagePath: imagePaths[i]!,
      audioPath,
      duration,
      text: narrations[i],
      burnSubtitles,
      width,
      height,
      zoomDirection: direction,
      outPath: segOut,
      fps,
      fadeIn: i > 0 ? 0.3 : 0,
      fadeOut: 0.3,
    });
    segmentPaths.push(segOut);
  }

  const listFile = join(workDir, "concat.txt");
  await writeFile(
    listFile,
    segmentPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"),
    "utf8",
  );

  // Concat sem reencode dos segmentos.
  const concatOut = join(workDir, "concat.mp4");
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])
      .on("error", (err, _o, stderr) =>
        reject(new Error(`ffmpeg concat: ${err.message}\n${stderr}`)),
      )
      .on("end", () => resolve())
      .save(concatOut);
  });

  if (bgmPath) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatOut)
        .input(bgmPath)
        .complexFilter([
          // Loop / trim do BGM ao tamanho do vídeo, com volume baixo,
          // depois mix com o áudio narrativo.
          "[1:a]aloop=loop=-1:size=2e+09[bgmloop]",
          "[bgmloop]volume=0.08[bgm]",
          "[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=0[a]",
        ])
        .outputOptions([
          "-map 0:v",
          "-map [a]",
          "-c:v copy",
          "-c:a aac",
          "-b:a 192k",
          "-shortest",
        ])
        .on("error", (err, _o, stderr) =>
          reject(new Error(`ffmpeg bgm mix: ${err.message}\n${stderr}`)),
        )
        .on("end", () => resolve())
        .save(outPath);
    });
  } else {
    // Apenas move/copia o concat para o destino final
    const buf = await readFile(concatOut);
    await writeFile(outPath, buf);
  }

  return outPath;
}

interface AssembleFashionOptions {
  imagePaths: string[];
  outPath: string;
  bgmPath?: string;
  perShotDuration?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export async function assembleFashion({
  imagePaths,
  outPath,
  bgmPath,
  perShotDuration = 2.2,
  width = 1080,
  height = 1920,
  fps = 30,
}: AssembleFashionOptions): Promise<string> {
  await ensureDir(dirname(outPath));
  const workDir = join(tmpdir(), `tomada_${randomBytes(6).toString("hex")}`);
  await ensureDir(workDir);

  const segmentPaths: string[] = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const segOut = join(workDir, `seg_${String(i).padStart(3, "0")}.mp4`);
    const direction: "in" | "out" = Math.random() < 0.5 ? "in" : "out";
    await renderScene({
      imagePath: imagePaths[i]!,
      duration: perShotDuration,
      burnSubtitles: false,
      width,
      height,
      zoomDirection: direction,
      outPath: segOut,
      fps,
      fadeIn: i > 0 ? 0.15 : 0,
      fadeOut: 0.15,
    });
    segmentPaths.push(segOut);
  }

  const listFile = join(workDir, "concat.txt");
  await writeFile(
    listFile,
    segmentPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"),
    "utf8",
  );

  const concatOut = join(workDir, "concat.mp4");
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])
      .on("error", (err, _o, stderr) =>
        reject(new Error(`ffmpeg concat fashion: ${err.message}\n${stderr}`)),
      )
      .on("end", () => resolve())
      .save(concatOut);
  });

  if (bgmPath) {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatOut)
        .input(bgmPath)
        .complexFilter([
          "[1:a]aloop=loop=-1:size=2e+09[bgmloop]",
          "[bgmloop]volume=0.85[bgm]",
        ])
        .outputOptions([
          "-map 0:v",
          "-map [bgm]",
          "-c:v copy",
          "-c:a aac",
          "-b:a 192k",
          "-shortest",
        ])
        .on("error", (err, _o, stderr) =>
          reject(new Error(`ffmpeg bgm fashion: ${err.message}\n${stderr}`)),
        )
        .on("end", () => resolve())
        .save(outPath);
    });
  } else {
    const buf = await readFile(concatOut);
    await writeFile(outPath, buf);
  }

  return outPath;
}

import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import { spawn } from "node:child_process";
import ytdl from "youtube-dl-exec";
import { getGenAI, MODELS } from "@/lib/gemini/client";
import { ytCacheDir } from "@/lib/utils/paths";
import type { ReferenceAnalysis } from "@/lib/types/jobs";

type ProgressFn = (msg: string, pct: number) => void | Promise<void>;

function ytSlug(url: string): string {
  return url.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40).replace(/^_+|_+$/g, "");
}

function ffmpegBin(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

function ffprobeBin(): string {
  const base = ffmpegBin();
  if (base === "ffmpeg") return "ffprobe";
  return base.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
}

async function downloadVideo(url: string): Promise<{ videoPath: string; infoPath: string }> {
  const workDir = ytCacheDir(ytSlug(url));
  await mkdir(workDir, { recursive: true });

  await ytdl(url, {
    format: "best[height<=720][ext=mp4]/best[ext=mp4]/best",
    output: join(workDir, "video.%(ext)s"),
    noPlaylist: true,
    writeInfoJson: true,
    quiet: true,
    noWarnings: true,
    retries: 3,
  });

  const files = await readdir(workDir);
  const video = files
    .filter((f) => f.startsWith("video.") && !f.endsWith(".json") && !f.endsWith(".part"))
    .map((f) => join(workDir, f))[0];
  if (!video) throw new Error("yt-dlp não baixou o vídeo");
  const info = join(workDir, "video.info.json");
  return { videoPath: video, infoPath: info };
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
      else reject(new Error(`ffprobe: ${err}`));
    });
  });
}

async function ffmpegRun(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), ["-loglevel", "error", "-y", ...args]);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg: ${stderr}`));
    });
  });
}

async function extractFrames(videoPath: string, numFrames = 6): Promise<string[]> {
  const dir = join(videoPath, "..", "frames");
  await mkdir(dir, { recursive: true });

  const duration = await probeDuration(videoPath);
  const interval = duration / (numFrames + 1);

  const out: string[] = [];
  for (let i = 0; i < numFrames; i++) {
    const t = interval * (i + 1);
    const outPath = join(dir, `frame_${String(i).padStart(3, "0")}.jpg`);
    await ffmpegRun([
      "-ss",
      String(t),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      outPath,
    ]);
    out.push(outPath);
  }
  return out;
}

async function extractAudio(videoPath: string): Promise<string> {
  const out = join(videoPath, "..", "audio.mp3");
  if (existsSync(out)) return out;
  await ffmpegRun([
    "-i",
    videoPath,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-q:a",
    "4",
    out,
  ]);
  return out;
}

async function transcribeWithGemini(audioPath: string): Promise<string> {
  const cache = join(audioPath, "..", "transcript.txt");
  if (existsSync(cache)) return readFile(cache, "utf8");

  const ai = getGenAI();
  const audioBuf = await readFile(audioPath);
  const response = await ai.models.generateContent({
    model: MODELS.text,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Transcreva o áudio a seguir em português brasileiro. " +
              "Retorne APENAS o texto transcrito, sem timestamps, sem marcações, em parágrafos naturais.",
          },
          {
            inlineData: {
              mimeType: "audio/mp3",
              data: audioBuf.toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      temperature: 0.1,
    },
  });

  const transcript = (response.text ?? "").trim();
  await writeFile(cache, transcript, "utf8");
  return transcript;
}

async function geminiAnalyze(
  title: string,
  description: string,
  transcript: string,
  framePaths: string[],
): Promise<Omit<ReferenceAnalysis, "title" | "transcript">> {
  const ai = getGenAI();

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [
    {
      text:
        `Você está analisando um vídeo do YouTube para servir de REFERÊNCIA na criação de um vídeo novo similar.\n\n` +
        `TÍTULO ORIGINAL: ${title}\n\n` +
        `DESCRIÇÃO: ${description}\n\n` +
        `TRANSCRIÇÃO DA NARRAÇÃO (PT-BR):\n${transcript.slice(0, 6000)}\n\n` +
        `Veja também os FRAMES-CHAVE anexados para entender o estilo visual.\n\n` +
        `Sua tarefa: analisar e retornar APENAS um JSON neste formato exato (sem markdown):\n` +
        `{\n` +
        `  "narrativeStyle": "Descrição em PT-BR do estilo de narração: ritmo, vocabulário, tipos de gancho, estrutura",\n` +
        `  "visualStyle": "English description of visual style to use in image prompts: lighting, color grading, composition, mood, camera angle",\n` +
        `  "tone": "Tom emocional dominante em PT-BR (ex: misterioso, descontraído, sério, etc)",\n` +
        `  "themes": ["lista", "de", "temas", "principais"],\n` +
        `  "suggestedTopic": "Sugestão de tema similar em PT-BR para o novo vídeo (não copiar, criar variação)"\n` +
        `}`,
    },
  ];

  for (const fp of framePaths.slice(0, 6)) {
    const data = await readFile(fp);
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: data.toString("base64") },
    });
  }

  const response = await ai.models.generateContent({
    model: MODELS.text,
    contents: [{ role: "user", parts }],
    config: {
      temperature: 0.5,
      responseMimeType: "application/json",
    },
  });

  const text = (response.text ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(text);
}

export async function analyzeReference(
  url: string,
  onProgress?: ProgressFn,
): Promise<ReferenceAnalysis> {
  const step = async (msg: string, pct: number) => {
    if (onProgress) await onProgress(msg, pct);
  };

  await step("Baixando vídeo do YouTube...", 5);
  const { videoPath, infoPath } = await downloadVideo(url);

  await step("Extraindo frames-chave...", 25);
  const frames = await extractFrames(videoPath, 6);

  await step("Extraindo áudio...", 40);
  const audio = await extractAudio(videoPath);

  await step("Transcrevendo narração com Gemini...", 50);
  const transcript = await transcribeWithGemini(audio);

  let title = "";
  let description = "";
  if (existsSync(infoPath)) {
    const info = JSON.parse(await readFile(infoPath, "utf8"));
    title = info.title ?? "";
    description = (info.description ?? "").slice(0, 1500);
  } else {
    title = basename(videoPath);
  }

  await step("Analisando estilo com Gemini...", 75);
  const analysis = await geminiAnalyze(title, description, transcript, frames);
  await step("Análise concluída", 100);

  return {
    title,
    transcript,
    narrativeStyle: analysis.narrativeStyle ?? "",
    visualStyle: analysis.visualStyle ?? "",
    tone: analysis.tone ?? "",
    themes: analysis.themes ?? [],
    suggestedTopic: analysis.suggestedTopic ?? "",
  };
}

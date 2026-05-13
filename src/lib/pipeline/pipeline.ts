import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Job, JobParams, JobResult, NarratedJobParams, FashionJobParams } from "@/lib/types/jobs";
import { generateScript } from "./script-generator";
import { generateImage } from "./image-generator";
import { synthesizeScenes } from "./tts";
import { assembleNarrated, assembleFashion } from "./video-assembler";
import { generateFashionShots } from "./fashion-generator";
import { analyzeReference } from "./youtube-reference";
import { getOutputDir } from "@/lib/utils/paths";
import { slug } from "@/lib/utils/time";

export type ProgressFn = (msg: string, pct: number) => void | Promise<void>;

export async function runPipeline(
  job: Job,
  onProgress: ProgressFn,
): Promise<JobResult> {
  await mkdir(getOutputDir(), { recursive: true });

  if (job.params.videoType === "fashion") {
    return runFashion(job.id, job.params, onProgress);
  }
  return runNarrated(job.id, job.params, onProgress);
}

async function runNarrated(
  jobId: string,
  params: NarratedJobParams,
  onProgress: ProgressFn,
): Promise<JobResult> {
  const {
    topic,
    numScenes,
    style,
    videoFormat,
    imageProvider,
    voice,
    burnSubtitles,
    referenceUrl,
  } = params;

  const report = async (msg: string, pct: number) => {
    await onProgress(msg, pct);
    // eslint-disable-next-line no-console
    console.log(`[${pct.toFixed(1).padStart(5)}%] ${msg}`);
  };

  let reference = null;
  if (referenceUrl && referenceUrl.trim()) {
    reference = await analyzeReference(referenceUrl.trim(), async (msg, pct) => {
      await report(`[REFERÊNCIA] ${msg}`, pct * 0.15);
    });
    await report(`Referência analisada: ${reference.tone}`, 15);
  }

  await report("Gerando roteiro com Gemini...", 18);
  const script = await generateScript({
    topic,
    numScenes,
    style,
    videoFormat,
    reference,
  });
  await report(`Roteiro: '${script.title}' (${script.scenes.length} cenas)`, 25);

  await report("Gerando imagens...", 28);
  const imagePaths: string[] = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const pct = 28 + (35 * (i + 1)) / script.scenes.length;
    await report(`Imagem ${i + 1}/${script.scenes.length}`, pct);
    const path = await generateImage({
      prompt: script.scenes[i]!.visual,
      seed: 1000 + i,
      aspectRatio: videoFormat,
      provider: imageProvider,
    });
    imagePaths.push(path);
  }
  await report("Imagens prontas", 65);

  await report("Sintetizando narração com Gemini TTS...", 68);
  const audioPaths = await synthesizeScenes(script.scenes, jobId, voice);
  await report("Áudios prontos", 82);

  await report("Montando vídeo...", 85);
  const narrations = script.scenes.map((s) => s.narration);
  const ts = Date.now();
  const outFile = join(getOutputDir(), `${ts}_${slug(script.title)}.mp4`);
  const [width, height] = videoFormat === "16:9" ? [1920, 1080] : [1080, 1920];

  await assembleNarrated({
    imagePaths,
    audioPaths,
    narrations,
    outPath: outFile,
    burnSubtitles,
    width,
    height,
  });
  await report(`Pronto: ${outFile}`, 100);

  return {
    videoPath: outFile,
    videoUrl: "", // preenchido pelo worker após upload
    title: script.title,
    videoType: "narrated",
    scenes: script.scenes,
    referenceApplied: Boolean(reference),
  };
}

async function runFashion(
  jobId: string,
  params: FashionJobParams,
  onProgress: ProgressFn,
): Promise<JobResult> {
  const {
    modelImagePath,
    outfitImagePaths,
    sceneIdea,
    numShots,
    shotDuration,
    bgmPath,
    title,
  } = params;

  const report = async (msg: string, pct: number) => {
    await onProgress(msg, pct);
    // eslint-disable-next-line no-console
    console.log(`[fashion ${pct.toFixed(1).padStart(5)}%] ${msg}`);
  };

  const shots = await generateFashionShots({
    jobId,
    modelImagePath,
    outfitImagePaths,
    sceneIdea,
    numShots,
    onProgress: async (msg, pct) => {
      await report(msg, pct * 0.85);
    },
  });

  await report("Montando vídeo TikTok...", 88);
  const ts = Date.now();
  const finalTitle = title || `Fashion · ${sceneIdea.slice(0, 40)}`;
  const outFile = join(getOutputDir(), `${ts}_${slug(finalTitle)}.mp4`);
  await assembleFashion({
    imagePaths: shots,
    outPath: outFile,
    bgmPath,
    perShotDuration: shotDuration,
    width: 1080,
    height: 1920,
  });
  await report("Pronto", 100);

  return {
    videoPath: outFile,
    videoUrl: "",
    title: finalTitle,
    videoType: "fashion",
    shotPaths: shots,
  };
}

export type { JobParams };

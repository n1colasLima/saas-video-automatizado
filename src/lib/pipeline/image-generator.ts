import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getGenAI, MODELS } from "@/lib/gemini/client";
import type { ImageProvider, VideoFormat } from "@/lib/types/jobs";
import { getCacheDir } from "@/lib/utils/paths";
import { sleep } from "@/lib/utils/time";

const POLLINATIONS_BASE =
  process.env.POLLINATIONS_BASE_URL ?? "https://image.pollinations.ai/prompt";

function cachePath(prompt: string, seed: number, provider: ImageProvider): string {
  const key = createHash("sha256")
    .update(`${provider}|${prompt}|${seed}`)
    .digest("hex")
    .slice(0, 20);
  return join(getCacheDir(), `img_${provider}_${key}.jpg`);
}

function isCacheValid(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    return statSync(path).size > 1000;
  } catch {
    return false;
  }
}

async function geminiGenerate(
  prompt: string,
  outPath: string,
  aspectRatio: VideoFormat,
): Promise<string> {
  const ai = getGenAI();

  const fullPrompt =
    `Generate a single cinematic, photorealistic image in ${aspectRatio} aspect ratio. ` +
    `High production quality, professional cinematography, dramatic lighting, sharp focus, ` +
    `detailed textures. No text, no captions, no watermarks in the image.\n\n` +
    `Scene: ${prompt}`;

  const response = await ai.models.generateContent({
    model: MODELS.image,
    contents: fullPrompt,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data) {
      const buffer = Buffer.from(inline.data as string, "base64");
      await writeFile(outPath, buffer);
      return outPath;
    }
  }
  throw new Error("Gemini não retornou imagem");
}

async function pollinationsGenerate(
  prompt: string,
  seed: number,
  outPath: string,
  width: number,
  height: number,
): Promise<string> {
  const fullPrompt = `${prompt}, cinematic, photorealistic, 8k, high detail`;
  const url = new URL(`${POLLINATIONS_BASE}/${encodeURIComponent(fullPrompt)}`);
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("seed", String(seed));
  url.searchParams.set("nologo", "true");
  url.searchParams.set("enhance", "true");
  url.searchParams.set("model", "flux");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`Pollinations HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength < 1000) {
      throw new Error("Imagem retornada muito pequena");
    }
    await writeFile(outPath, buf);
    return outPath;
  } finally {
    clearTimeout(timeout);
  }
}

export interface GenerateImageOptions {
  prompt: string;
  seed?: number;
  aspectRatio?: VideoFormat;
  provider?: ImageProvider;
  retries?: number;
}

export async function generateImage({
  prompt,
  seed = 42,
  aspectRatio = "16:9",
  provider = "gemini",
  retries = 3,
}: GenerateImageOptions): Promise<string> {
  await mkdir(getCacheDir(), { recursive: true });

  const cache = cachePath(prompt, seed, provider);
  if (isCacheValid(cache)) return cache;

  const [width, height] = aspectRatio === "16:9" ? [1920, 1080] : [1080, 1920];

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (provider === "gemini") {
        return await geminiGenerate(prompt, cache, aspectRatio);
      }
      return await pollinationsGenerate(prompt, seed, cache, width, height);
    } catch (err) {
      lastErr = err as Error;
      await sleep(1000 * 2 ** attempt);
    }
  }

  if (provider === "gemini") {
    // fallback automático para Pollinations
    try {
      const fallbackCache = cachePath(prompt, seed, "pollinations");
      if (isCacheValid(fallbackCache)) return fallbackCache;
      return await pollinationsGenerate(prompt, seed, fallbackCache, width, height);
    } catch (err) {
      lastErr = err as Error;
    }
  }

  throw new Error(
    `Falha ao gerar imagem após ${retries} tentativas: ${lastErr?.message ?? "desconhecido"}`,
  );
}

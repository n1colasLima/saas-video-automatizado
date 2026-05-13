import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { getGenAI, MODELS } from "@/lib/gemini/client";
import { fashionCacheDir } from "@/lib/utils/paths";
import { sleep } from "@/lib/utils/time";

const SYSTEM_RULES = `You are a professional fashion photographer AI generating product-modeling photos for e-commerce / TikTok Shop content.

NON-NEGOTIABLE rules for every image you generate:
1. The MODEL's face, body type, skin tone, hair and overall identity MUST match the reference model photo exactly. Do NOT change the model into a different person.
2. The OUTFIT must match the reference clothing photos exactly: same color, same pattern, same cut, same fabric. The model must be wearing this exact outfit, not a generic version.
3. Full body shot, head to feet visible in frame, vertical 9:16 aspect ratio composition.
4. Studio-quality photorealism: sharp focus on the model, realistic skin texture, natural lighting appropriate to the scene, professional color grading.
5. Natural confident pose. The model looks at the camera with a natural, relaxed expression (not stiff, not overly posed). Slight movement implied (shifting weight, hand on hip, walking, adjusting clothing).
6. The model is the focal point — clothing must be clearly visible and the hero of the shot.
7. NO text, NO logos overlays, NO watermarks, NO captions in the image.
8. NO multiple people, NO collages, NO split screens. Single subject only.
`;

const POSE_VARIATIONS = [
  "Full body shot, model facing the camera, weight on one leg, one hand naturally at side, the other lightly on hip. Soft smile.",
  "Full body 3/4 angle. Model turned slightly to the side showing the silhouette of the outfit. Looking back at the camera.",
  "Full body shot. Model mid-stride, walking towards the camera, natural movement, hair flowing.",
  "Full body shot. Model adjusting a detail of the outfit (cuff, hem, waistband) while looking at the camera with a relaxed expression.",
  "Full body shot, model facing the camera with both hands relaxed, slight head tilt, confident neutral expression.",
  "Full body shot. Model leaning casually against a wall or surface in the scene, looking directly at the camera.",
  "Full body 3/4 back-turn pose, head turned over shoulder showing the back of the outfit, friendly expression.",
  "Full body shot. Model with arms slightly away from the body to show the fit of the outfit. Direct eye contact, relaxed shoulders.",
];

async function ensurePilJpegBytes(imagePath: string, maxSide = 1280): Promise<Buffer> {
  const buf = await readFile(imagePath);
  const img = sharp(buf);
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  let pipeline = img.rotate();
  if (Math.max(w, h) > maxSide) {
    if (w >= h) {
      pipeline = pipeline.resize({ width: maxSide });
    } else {
      pipeline = pipeline.resize({ height: maxSide });
    }
  }
  return pipeline.jpeg({ quality: 88 }).toBuffer();
}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function suggestScenesWithGemini(sceneIdea: string, numScenes: number): Promise<string[]> {
  const ai = getGenAI();
  const systemInstruction =
    "Você ajuda a planejar fotos de moda para TikTok Shop. " +
    "Dada uma IDEIA do usuário (geralmente em PT-BR), produza uma lista de variações de cena " +
    "(em INGLÊS, pois serão usadas como prompt para um modelo de imagem). " +
    "Cada cena deve manter o mesmo cenário base mas variar: ângulo de câmera, distância, iluminação sutil, " +
    "ou pose implícita do ambiente (ex.: 'next to mirror' vs 'walking through the doorway'). " +
    "NÃO mude o cenário entre as cenas — mesma locação, mesma roupa, ângulos diferentes. " +
    `Responda APENAS um JSON: {"scenes": ["scene 1 in English", "scene 2 in English", ...]}`;

  const response = await ai.models.generateContent({
    model: MODELS.text,
    contents: `IDEIA: ${sceneIdea}\n\nGere ${numScenes} variações de cena.`,
    config: {
      systemInstruction,
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  });

  const raw = stripCodeFence(response.text ?? "");
  try {
    const parsed = JSON.parse(raw) as { scenes?: string[] };
    const scenes = parsed.scenes ?? [];
    if (scenes.length === 0) return Array.from({ length: numScenes }, () => sceneIdea);
    return scenes.slice(0, numScenes);
  } catch {
    return Array.from({ length: numScenes }, () => sceneIdea);
  }
}

function buildUserPrompt(sceneDescription: string, variationIdx: number): string {
  const pose = POSE_VARIATIONS[variationIdx % POSE_VARIATIONS.length];
  return (
    `Generate ONE photorealistic full-body image, 9:16 vertical.\n\n` +
    `SCENE: ${sceneDescription}\n\n` +
    `POSE / FRAMING for this specific shot: ${pose}\n\n` +
    `Remember: same model identity as the reference, same outfit as the reference clothing photos, ` +
    `natural confident pose, head-to-feet visible, professional studio quality, looking at camera.`
  );
}

async function geminiImageCall(
  modelBytes: Buffer,
  outfitBytesList: Buffer[],
  userPrompt: string,
): Promise<Buffer> {
  const ai = getGenAI();

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  parts.push({ text: SYSTEM_RULES });
  parts.push({ text: "REFERENCE MODEL PHOTO (use this person's face and body):" });
  parts.push({
    inlineData: {
      mimeType: "image/jpeg",
      data: modelBytes.toString("base64"),
    },
  });
  outfitBytesList.forEach((outfit, i) => {
    parts.push({
      text: `REFERENCE OUTFIT PHOTO ${i + 1} (the model must wear this clothing):`,
    });
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: outfit.toString("base64"),
      },
    });
  });
  parts.push({ text: userPrompt });

  const response = await ai.models.generateContent({
    model: MODELS.image,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "9:16" },
    },
  });

  const respParts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of respParts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data as string, "base64");
    }
  }
  throw new Error("Gemini Image (fashion) não retornou imagem");
}

export interface GenerateFashionShotsOptions {
  jobId: string;
  modelImagePath: string;
  outfitImagePaths: string[];
  sceneIdea: string;
  numShots: number;
  onProgress?: (msg: string, pct: number) => void | Promise<void>;
}

export async function generateFashionShots({
  jobId,
  modelImagePath,
  outfitImagePaths,
  sceneIdea,
  numShots,
  onProgress,
}: GenerateFashionShotsOptions): Promise<string[]> {
  const step = async (msg: string, pct: number) => {
    if (onProgress) await onProgress(msg, pct);
    // eslint-disable-next-line no-console
    console.log(`[fashion-gen ${pct.toFixed(1)}%] ${msg}`);
  };

  const outDir = fashionCacheDir(jobId);
  await mkdir(outDir, { recursive: true });

  await step("Preparando imagens de referência...", 2);
  const modelBytes = await ensurePilJpegBytes(modelImagePath);
  const outfitBytes: Buffer[] = [];
  for (const p of outfitImagePaths) {
    outfitBytes.push(await ensurePilJpegBytes(p));
  }

  await step("Planejando variações de cena com Gemini...", 8);
  const scenePrompts = await suggestScenesWithGemini(sceneIdea, numShots);

  const outputPaths: string[] = [];
  for (let i = 0; i < scenePrompts.length; i++) {
    const pct = 10 + (80 * i) / Math.max(1, numShots);
    await step(`Gerando imagem ${i + 1}/${numShots}...`, pct);
    const userPrompt = buildUserPrompt(scenePrompts[i]!, i);

    let lastErr: Error | null = null;
    let succeeded = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const jpgBytes = await geminiImageCall(modelBytes, outfitBytes, userPrompt);
        const outPath = join(outDir, `shot_${String(i).padStart(3, "0")}.jpg`);
        await writeFile(outPath, jpgBytes);
        outputPaths.push(outPath);
        succeeded = true;
        break;
      } catch (err) {
        lastErr = err as Error;
        await sleep(1000 * 2 ** attempt);
      }
    }
    if (!succeeded) {
      throw new Error(
        `Falha ao gerar imagem ${i + 1}: ${lastErr?.message ?? "desconhecido"}`,
      );
    }
  }

  await step("Imagens prontas", 95);
  return outputPaths;
}

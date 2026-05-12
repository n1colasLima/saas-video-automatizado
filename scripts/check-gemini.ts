/**
 * Sanity check da key Gemini para os modelos do free tier.
 *   npx tsx scripts/check-gemini.ts
 */

import "dotenv/config";
import { getGenAI, MODELS } from "@/lib/gemini/client";

async function checkText() {
  process.stdout.write(`[text  ] ${MODELS.text.padEnd(40)} ... `);
  const ai = getGenAI();
  const r = await ai.models.generateContent({
    model: MODELS.text,
    contents: "Diga apenas 'ok' em PT-BR.",
    config: { temperature: 0 },
  });
  const ok = (r.text ?? "").toLowerCase().includes("ok");
  console.log(ok ? "✓" : `? resposta="${r.text}"`);
}

async function checkTts() {
  process.stdout.write(`[tts   ] ${MODELS.tts.padEnd(40)} ... `);
  const ai = getGenAI();
  const r = await ai.models.generateContent({
    model: MODELS.tts,
    contents: "Olá, isso é um teste.",
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      },
    },
  });
  const parts = r.candidates?.[0]?.content?.parts ?? [];
  const audio = parts.find((p) => p.inlineData?.data);
  if (audio?.inlineData?.data) {
    const bytes = Buffer.from(audio.inlineData.data as string, "base64").length;
    console.log(`✓ (${bytes} bytes PCM)`);
  } else {
    console.log("✗ sem inlineData");
  }
}

async function checkImageOptional() {
  process.stdout.write(`[image ] ${MODELS.image.padEnd(40)} ... `);
  try {
    const ai = getGenAI();
    const r = await ai.models.generateContent({
      model: MODELS.image,
      contents: "Generate a small 16:9 image of a single red apple on a white background.",
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "16:9" },
      },
    });
    const parts = r.candidates?.[0]?.content?.parts ?? [];
    const hasImage = parts.some((p) => p.inlineData?.data);
    console.log(hasImage ? "✓" : "✗ sem inlineData");
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      console.log("- (quota 0; OK: vamos usar Pollinations como default)");
    } else {
      console.log(`✗ ${msg.slice(0, 100)}`);
    }
  }
}

async function main() {
  console.log("Validando acesso aos modelos do Gemini...\n");
  for (const fn of [checkText, checkTts, checkImageOptional]) {
    try {
      await fn();
    } catch (err) {
      console.log(`✗\n   ${(err as Error).message}`);
    }
  }
  process.exit(0);
}

main();

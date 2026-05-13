import { GoogleGenAI } from "@google/genai";

let cached: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY ausente no ambiente");
  }
  cached = new GoogleGenAI({ apiKey });
  return cached;
}

/**
 * Modelos são resolvidos sob demanda (não na carga do módulo) para que
 * `dotenv/config` em outro arquivo já tenha populado `process.env`.
 *
 * Uso: `MODELS.text` continua igual a antes — mas agora cada acesso lê o env.
 */
export const MODELS = {
  get text(): string {
    return process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
  },
  get image(): string {
    return process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview";
  },
  get tts(): string {
    return process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
  },
} as const;

export const DEFAULT_TTS_VOICE = process.env.GEMINI_TTS_VOICE ?? "Kore";

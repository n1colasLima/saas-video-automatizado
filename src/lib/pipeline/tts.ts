import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { getGenAI, MODELS, DEFAULT_TTS_VOICE } from "@/lib/gemini/client";
import type { SceneScript } from "@/lib/types/jobs";
import { jobCacheDir } from "@/lib/utils/paths";
import { join } from "node:path";

/**
 * Gemini 2.5 Pro Preview TTS retorna PCM 16-bit signed little-endian 24kHz mono.
 * Precisamos:
 *  1. Receber a parte inlineData (base64 PCM cru).
 *  2. Envolver em um header WAV.
 *  3. Converter para MP3 via ffmpeg (para o pipeline de vídeo).
 */

interface TTSOptions {
  text: string;
  outPath: string; // .mp3
  voice?: string;
}

function buildWavFromPcm(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.length;

  const buf = Buffer.alloc(44 + dataSize);
  // RIFF header
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  // fmt chunk
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  // data chunk
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  pcm.copy(buf, 44);
  return buf;
}

function ffmpegBin(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

async function convertWavToMp3(wavBuf: Buffer, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), [
      "-loglevel",
      "error",
      "-y",
      "-f",
      "wav",
      "-i",
      "pipe:0",
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      outPath,
    ]);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg falhou (${code}): ${stderr}`));
    });
    proc.stdin.write(wavBuf);
    proc.stdin.end();
  });
}

export async function synthesize({ text, outPath, voice }: TTSOptions): Promise<string> {
  const ai = getGenAI();
  const chosenVoice = voice ?? DEFAULT_TTS_VOICE;

  const response = await ai.models.generateContent({
    model: MODELS.tts,
    contents: text,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: chosenVoice },
        },
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let pcmBase64: string | null = null;
  for (const part of parts) {
    if (part.inlineData?.data) {
      pcmBase64 = part.inlineData.data as string;
      break;
    }
  }
  if (!pcmBase64) {
    throw new Error("Gemini TTS não retornou áudio");
  }

  const pcm = Buffer.from(pcmBase64, "base64");
  const wav = buildWavFromPcm(pcm);

  await mkdir(dirname(outPath), { recursive: true });
  await convertWavToMp3(wav, outPath);
  return outPath;
}

export async function synthesizeScenes(
  scenes: SceneScript[],
  jobId: string,
  voice?: string,
): Promise<string[]> {
  const dir = jobCacheDir(jobId);
  await mkdir(dir, { recursive: true });
  const out: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const path = join(dir, `audio_${String(i).padStart(3, "0")}.mp3`);
    await synthesize({ text: scenes[i]!.narration, outPath: path, voice });
    out.push(path);
  }
  return out;
}

const PT_BR_VOICES = ["Kore", "Puck", "Charon", "Fenrir", "Aoede"];
export function listVoices(): string[] {
  return PT_BR_VOICES.slice();
}

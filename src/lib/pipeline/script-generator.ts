import { getGenAI, MODELS } from "@/lib/gemini/client";
import type {
  NarratedStyle,
  ReferenceAnalysis,
  ScriptResult,
  VideoFormat,
} from "@/lib/types/jobs";

const BASE_SYSTEM = `Você é um roteirista profissional de vídeos do YouTube em português brasileiro.

Sua tarefa: dado um TEMA, criar um roteiro envolvente dividido em CENAS.

Regras gerais:
- Linguagem natural, conversacional, envolvente.
- Comece com um GANCHO forte nos primeiros 5 segundos.
- Cada cena tem 1 a 3 frases de narração (texto que será falado pela TTS).
- Cada cena precisa de uma DESCRIÇÃO VISUAL detalhada em INGLÊS para gerar a imagem (sem texto na imagem,
  estilo cinematográfico, foto realista de alta qualidade, descreva ambiente/personagens/iluminação/composição).
- Termine com um chamado para curtir/inscrever.
- NÃO use emojis na narração.
- NÃO inclua marcações como [música] ou (pausa).

Retorne APENAS um JSON válido neste formato exato (sem markdown, sem três crases):
{
  "title": "Título atrativo do vídeo",
  "scenes": [
    {
      "narration": "Texto que será falado nesta cena.",
      "visual": "Detailed English image prompt, cinematic, photorealistic"
    }
  ]
}
`;

const STYLE_HINTS: Record<NarratedStyle, string> = {
  curiosidades:
    "Estilo curiosidades: tom envolvente, com revelações progressivas. Use 'você sabia' com moderação.",
  misterios:
    "Estilo mistérios: tom misterioso e tenso. Pausas dramáticas implícitas, perguntas instigantes.",
  historia:
    "Estilo histórico: tom narrativo de documentário. Datas, lugares e personagens reais.",
  ciencia:
    "Estilo científico: tom didático mas acessível. Analogias do dia a dia.",
  tops:
    "Estilo lista/ranking: 'em primeiro lugar', 'agora o número', contagem regressiva ou progressiva.",
};

const FORMAT_SPECS: Record<VideoFormat, string> = {
  "16:9":
    "Formato horizontal 16:9 (YouTube tradicional). Descrições visuais devem privilegiar composições horizontais com profundidade.",
  "9:16":
    "Formato vertical 9:16 (Shorts/Reels/TikTok). Descrições visuais devem privilegiar enquadramento vertical, sujeito centralizado, fundo simples.",
};

function buildSystemPrompt(
  style: NarratedStyle,
  videoFormat: VideoFormat,
  reference: ReferenceAnalysis | null,
): string {
  const parts: string[] = [BASE_SYSTEM];
  if (STYLE_HINTS[style]) {
    parts.push(`\nESTILO ESCOLHIDO:\n${STYLE_HINTS[style]}`);
  }
  if (FORMAT_SPECS[videoFormat]) {
    parts.push(`\nFORMATO:\n${FORMAT_SPECS[videoFormat]}`);
  }
  if (reference) {
    const refLines = ["\nREFERÊNCIA DE INSPIRAÇÃO (analisada de um vídeo do YouTube):"];
    if (reference.narrativeStyle) {
      refLines.push(`- Estilo de narração a imitar: ${reference.narrativeStyle}`);
    }
    if (reference.tone) {
      refLines.push(`- Tom: ${reference.tone}`);
    }
    if (reference.visualStyle) {
      refLines.push(
        `- Estilo visual a aplicar em TODAS as descrições de imagem (em inglês): ${reference.visualStyle}`,
      );
    }
    if (reference.themes?.length) {
      refLines.push(`- Temas tocados: ${reference.themes.join(", ")}`);
    }
    refLines.push(
      "\nIMPORTANTE: NÃO copie o roteiro original. Use o tema e estilo como inspiração para criar um conteúdo NOVO e ORIGINAL.",
    );
    parts.push(refLines.join("\n"));
  }
  return parts.join("\n");
}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export interface GenerateScriptOptions {
  topic: string;
  numScenes?: number;
  style?: NarratedStyle;
  videoFormat?: VideoFormat;
  reference?: ReferenceAnalysis | null;
}

export async function generateScript({
  topic,
  numScenes = 12,
  style = "curiosidades",
  videoFormat = "16:9",
  reference = null,
}: GenerateScriptOptions): Promise<ScriptResult> {
  const ai = getGenAI();
  const systemInstruction = buildSystemPrompt(style, videoFormat, reference);

  const userPrompt =
    `TEMA: ${topic}\n\n` +
    `Gere um roteiro com exatamente ${numScenes} cenas. ` +
    `Cada cena com narração curta e descrição visual rica.`;

  const response = await ai.models.generateContent({
    model: MODELS.text,
    contents: userPrompt,
    config: {
      systemInstruction,
      temperature: 0.9,
      responseMimeType: "application/json",
    },
  });

  const rawText = response.text ?? "";
  const text = stripCodeFence(rawText);
  if (!text) {
    throw new Error("Gemini retornou resposta vazia para o roteiro");
  }

  let parsed: ScriptResult;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Resposta do Gemini não é JSON válido: ${(err as Error).message}`);
  }
  if (!parsed.title || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error("Resposta do Gemini sem formato esperado");
  }
  return parsed;
}

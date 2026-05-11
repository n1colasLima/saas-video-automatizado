import json
import re
from google import genai
from google.genai import types
from .config import GEMINI_API_KEY

BASE_SYSTEM = """Você é um roteirista profissional de vídeos do YouTube em português brasileiro.

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

Retorne APENAS um JSON válido neste formato exato (sem markdown, sem ```):
{
  "title": "Título atrativo do vídeo",
  "scenes": [
    {
      "narration": "Texto que será falado nesta cena.",
      "visual": "Detailed English image prompt, cinematic, photorealistic"
    }
  ]
}
"""

STYLE_HINTS = {
    "curiosidades": "Estilo curiosidades: tom envolvente, com revelações progressivas. Use 'você sabia' com moderação.",
    "misterios": "Estilo mistérios: tom misterioso e tenso. Pausas dramáticas implícitas, perguntas instigantes.",
    "historia": "Estilo histórico: tom narrativo de documentário. Datas, lugares e personagens reais.",
    "ciencia": "Estilo científico: tom didático mas acessível. Analogias do dia a dia.",
    "tops": "Estilo lista/ranking: 'em primeiro lugar', 'agora o número', contagem regressiva ou progressiva.",
}

FORMAT_SPECS = {
    "16:9": "Formato horizontal 16:9 (YouTube tradicional). Descrições visuais devem privilegiar composições horizontais com profundidade.",
    "9:16": "Formato vertical 9:16 (Shorts/Reels/TikTok). Descrições visuais devem privilegiar enquadramento vertical, sujeito centralizado, fundo simples.",
}


def _build_system_prompt(style: str, video_format: str, reference: dict | None) -> str:
    parts = [BASE_SYSTEM]
    if style and style in STYLE_HINTS:
        parts.append(f"\nESTILO ESCOLHIDO:\n{STYLE_HINTS[style]}")
    if video_format and video_format in FORMAT_SPECS:
        parts.append(f"\nFORMATO:\n{FORMAT_SPECS[video_format]}")
    if reference:
        ref_lines = ["\nREFERÊNCIA DE INSPIRAÇÃO (analisada de um vídeo do YouTube):"]
        if reference.get("narrative_style"):
            ref_lines.append(f"- Estilo de narração a imitar: {reference['narrative_style']}")
        if reference.get("tone"):
            ref_lines.append(f"- Tom: {reference['tone']}")
        if reference.get("visual_style"):
            ref_lines.append(f"- Estilo visual a aplicar em TODAS as descrições de imagem (em inglês): {reference['visual_style']}")
        if reference.get("themes"):
            ref_lines.append(f"- Temas tocados: {', '.join(reference['themes'])}")
        ref_lines.append("\nIMPORTANTE: NÃO copie o roteiro original. Use o tema e estilo como inspiração para criar um conteúdo NOVO e ORIGINAL.")
        parts.append("\n".join(ref_lines))
    return "\n".join(parts)


def generate_script(
    topic: str,
    num_scenes: int = 12,
    style: str = "curiosidades",
    video_format: str = "16:9",
    reference: dict | None = None,
) -> dict:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY não configurada no .env")

    client = genai.Client(api_key=GEMINI_API_KEY)
    system = _build_system_prompt(style, video_format, reference)

    user_prompt = (
        f"TEMA: {topic}\n\n"
        f"Gere um roteiro com exatamente {num_scenes} cenas. "
        f"Cada cena com narração curta e descrição visual rica."
    )

    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.9,
            response_mime_type="application/json",
        ),
    )

    text = response.text.strip()
    text = re.sub(r"^```json\s*|\s*```$", "", text)
    data = json.loads(text)

    if "title" not in data or "scenes" not in data:
        raise ValueError("Resposta do Gemini sem formato esperado")
    return data

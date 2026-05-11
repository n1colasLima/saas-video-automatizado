"""
Gera imagens fotorrealistas de uma modelo vestindo uma roupa específica,
em variações de pose/ângulo/cenário, usando Gemini 3.1 Image com multi-input.

Cada chamada ao modelo recebe:
  - 1 imagem da modelo (referência facial e corporal)
  - 1+ imagens da roupa (peças que serão "vestidas")
  - Prompt textual com cenário e variação de pose
"""

import base64
import hashlib
import io
import json
import re
import time
from pathlib import Path
from typing import Callable, Iterable

from PIL import Image
from google import genai
from google.genai import types

from .config import CACHE_DIR, GEMINI_API_KEY

GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview"


SYSTEM_RULES = """You are a professional fashion photographer AI generating product-modeling photos for e-commerce / TikTok Shop content.

NON-NEGOTIABLE rules for every image you generate:
1. The MODEL's face, body type, skin tone, hair and overall identity MUST match the reference model photo exactly. Do NOT change the model into a different person.
2. The OUTFIT must match the reference clothing photos exactly: same color, same pattern, same cut, same fabric. The model must be wearing this exact outfit, not a generic version.
3. Full body shot, head to feet visible in frame, vertical 9:16 aspect ratio composition.
4. Studio-quality photorealism: sharp focus on the model, realistic skin texture, natural lighting appropriate to the scene, professional color grading.
5. Natural confident pose. The model looks at the camera with a natural, relaxed expression (not stiff, not overly posed). Slight movement implied (shifting weight, hand on hip, walking, adjusting clothing).
6. The model is the focal point — clothing must be clearly visible and the hero of the shot.
7. NO text, NO logos overlays, NO watermarks, NO captions in the image.
8. NO multiple people, NO collages, NO split screens. Single subject only.
"""


def _ensure_pil_jpeg_bytes(img_path: Path | str, max_side: int = 1280) -> bytes:
    """Open any image, downscale to keep payload small, return JPEG bytes."""
    img = Image.open(str(img_path)).convert("RGB")
    w, h = img.size
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88)
    return buf.getvalue()


def _scene_cache_key(model_path: Path, outfit_paths: list[Path], scene_prompt: str, variation_idx: int) -> str:
    h = hashlib.sha256()
    h.update(str(model_path).encode())
    for p in outfit_paths:
        h.update(str(p).encode())
    h.update(scene_prompt.encode())
    h.update(str(variation_idx).encode())
    return h.hexdigest()[:20]


# Pose / framing variations the AI should cycle through across scenes
POSE_VARIATIONS = [
    "Full body shot, model facing the camera, weight on one leg, one hand naturally at side, the other lightly on hip. Soft smile.",
    "Full body 3/4 angle. Model turned slightly to the side showing the silhouette of the outfit. Looking back at the camera.",
    "Full body shot. Model mid-stride, walking towards the camera, natural movement, hair flowing.",
    "Full body shot. Model adjusting a detail of the outfit (cuff, hem, waistband) while looking at the camera with a relaxed expression.",
    "Full body shot, model facing the camera with both hands relaxed, slight head tilt, confident neutral expression.",
    "Full body shot. Model leaning casually against a wall or surface in the scene, looking directly at the camera.",
    "Full body 3/4 back-turn pose, head turned over shoulder showing the back of the outfit, friendly expression.",
    "Full body shot. Model with arms slightly away from the body to show the fit of the outfit. Direct eye contact, relaxed shoulders.",
]


def _build_user_prompt(scene_description: str, variation_idx: int) -> str:
    pose = POSE_VARIATIONS[variation_idx % len(POSE_VARIATIONS)]
    return (
        f"Generate ONE photorealistic full-body image, 9:16 vertical.\n\n"
        f"SCENE: {scene_description}\n\n"
        f"POSE / FRAMING for this specific shot: {pose}\n\n"
        f"Remember: same model identity as the reference, same outfit as the reference clothing photos, "
        f"natural confident pose, head-to-feet visible, professional studio quality, looking at camera."
    )


def _gemini_call(
    model_bytes: bytes,
    outfit_bytes_list: list[bytes],
    user_prompt: str,
    aspect_ratio: str = "9:16",
) -> bytes:
    """Single call to Gemini Image; returns raw JPEG bytes of the generated image."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY não configurada")

    client = genai.Client(api_key=GEMINI_API_KEY)

    parts: list[types.Part] = [
        types.Part.from_text(text=SYSTEM_RULES),
        types.Part.from_text(text="REFERENCE MODEL PHOTO (use this person's face and body):"),
        types.Part.from_bytes(data=model_bytes, mime_type="image/jpeg"),
    ]
    for i, outfit in enumerate(outfit_bytes_list):
        parts.append(types.Part.from_text(text=f"REFERENCE OUTFIT PHOTO {i+1} (the model must wear this clothing):"))
        parts.append(types.Part.from_bytes(data=outfit, mime_type="image/jpeg"))
    parts.append(types.Part.from_text(text=user_prompt))

    response = client.models.generate_content(
        model=GEMINI_IMAGE_MODEL,
        contents=[types.Content(role="user", parts=parts)],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=aspect_ratio),
        ),
    )

    for part in response.candidates[0].content.parts:
        if getattr(part, "inline_data", None) and part.inline_data.data:
            data = part.inline_data.data
            if isinstance(data, str):
                data = base64.b64decode(data)
            img = Image.open(io.BytesIO(data)).convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=92)
            return buf.getvalue()

    raise RuntimeError("Gemini não retornou imagem")


def _suggest_scenes_with_gemini(scene_idea: str, num_scenes: int) -> list[str]:
    """Use a text LLM call to break down a user idea into N distinct camera scenes."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY não configurada")

    client = genai.Client(api_key=GEMINI_API_KEY)

    system = (
        "Você ajuda a planejar fotos de moda para TikTok Shop. "
        "Dada uma IDEIA do usuário (geralmente em PT-BR), produza uma lista de variações de cena "
        "(em INGLÊS, pois serão usadas como prompt para um modelo de imagem). "
        "Cada cena deve manter o mesmo cenário base mas variar: ângulo de câmera, distância, iluminação sutil, "
        "ou pose implícita do ambiente (ex.: 'next to mirror' vs 'walking through the doorway'). "
        "NÃO mude o cenário entre as cenas — mesma locação, mesma roupa, ângulos diferentes. "
        "Responda APENAS um JSON: {\"scenes\": [\"scene 1 in English\", \"scene 2 in English\", ...]}"
    )
    user = f"IDEIA: {scene_idea}\n\nGere {num_scenes} variações de cena."

    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.7,
            response_mime_type="application/json",
        ),
    )
    text = response.text.strip()
    text = re.sub(r"^```json\s*|\s*```$", "", text)
    data = json.loads(text)
    scenes = data.get("scenes", [])
    if not scenes:
        # Fallback: replicate the same idea
        scenes = [scene_idea] * num_scenes
    return scenes[:num_scenes]


def generate_fashion_shots(
    model_image: Path,
    outfit_images: list[Path],
    scene_idea: str,
    num_shots: int = 6,
    aspect_ratio: str = "9:16",
    progress: Callable[[str, float], None] | None = None,
) -> list[Path]:
    """
    High-level entrypoint. Returns paths of generated JPEG images.
    `scene_idea`: free-text in any language describing the setting and vibe.
    """

    def step(msg: str, pct: float):
        if progress:
            progress(msg, pct)
        print(f"[fashion {pct:5.1f}%] {msg}")

    out_dir = CACHE_DIR / f"fashion_{int(time.time())}"
    out_dir.mkdir(parents=True, exist_ok=True)

    step("Preparando imagens de referência...", 2)
    model_bytes = _ensure_pil_jpeg_bytes(model_image)
    outfit_bytes = [_ensure_pil_jpeg_bytes(p) for p in outfit_images]

    step("Planejando variações de cena com Gemini...", 8)
    scene_prompts = _suggest_scenes_with_gemini(scene_idea, num_shots)

    output_paths: list[Path] = []
    for i, scene_prompt in enumerate(scene_prompts):
        pct = 10 + 80 * (i / max(1, num_shots))
        step(f"Gerando imagem {i+1}/{num_shots}...", pct)
        user_prompt = _build_user_prompt(scene_prompt, variation_idx=i)

        last_err: Exception | None = None
        for attempt in range(3):
            try:
                jpg_bytes = _gemini_call(
                    model_bytes, outfit_bytes, user_prompt, aspect_ratio=aspect_ratio,
                )
                out_path = out_dir / f"shot_{i:03d}.jpg"
                out_path.write_bytes(jpg_bytes)
                output_paths.append(out_path)
                break
            except Exception as e:
                last_err = e
                time.sleep(2 ** attempt)
        else:
            raise RuntimeError(f"Falha ao gerar imagem {i+1}: {last_err}")

    step("Imagens prontas", 95)
    return output_paths

import base64
import hashlib
import io
import time
from pathlib import Path
import requests
from urllib.parse import quote
from PIL import Image
from google import genai
from google.genai import types
from .config import CACHE_DIR, GEMINI_API_KEY, VIDEO_WIDTH, VIDEO_HEIGHT

GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview"
POLLINATIONS_URL = "https://image.pollinations.ai/prompt/{prompt}"


def _cache_path(prompt: str, seed: int, provider: str) -> Path:
    key = hashlib.sha256(f"{provider}|{prompt}|{seed}".encode()).hexdigest()[:20]
    return CACHE_DIR / f"img_{provider}_{key}.jpg"


def _gemini_generate(prompt: str, out_path: Path, aspect_ratio: str = "16:9") -> Path:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY não configurada")

    client = genai.Client(api_key=GEMINI_API_KEY)

    full_prompt = (
        f"Generate a single cinematic, photorealistic image in {aspect_ratio} aspect ratio. "
        f"High production quality, professional cinematography, dramatic lighting, sharp focus, "
        f"detailed textures. No text, no captions, no watermarks in the image.\n\n"
        f"Scene: {prompt}"
    )

    response = client.models.generate_content(
        model=GEMINI_IMAGE_MODEL,
        contents=full_prompt,
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
            img.save(out_path, "JPEG", quality=92)
            return out_path

    raise RuntimeError("Gemini não retornou imagem")


def _pollinations_generate(
    prompt: str, seed: int, out_path: Path,
    width: int = VIDEO_WIDTH, height: int = VIDEO_HEIGHT,
) -> Path:
    full_prompt = f"{prompt}, cinematic, photorealistic, 8k, high detail"
    url = POLLINATIONS_URL.format(prompt=quote(full_prompt))
    params = {
        "width": width, "height": height, "seed": seed,
        "nologo": "true", "enhance": "true", "model": "flux",
    }
    r = requests.get(url, params=params, timeout=120)
    r.raise_for_status()
    if len(r.content) < 1000:
        raise RuntimeError("Imagem retornada muito pequena")
    out_path.write_bytes(r.content)
    return out_path


def generate_image(
    prompt: str,
    seed: int = 42,
    aspect_ratio: str = "16:9",
    provider: str = "gemini",
    retries: int = 3,
) -> Path:
    cache = _cache_path(prompt, seed, provider)
    if cache.exists() and cache.stat().st_size > 1000:
        return cache

    last_err = None
    for attempt in range(retries):
        try:
            if provider == "gemini":
                return _gemini_generate(prompt, cache, aspect_ratio=aspect_ratio)
            else:
                w, h = (VIDEO_WIDTH, VIDEO_HEIGHT) if aspect_ratio == "16:9" else (1080, 1920)
                return _pollinations_generate(prompt, seed, cache, width=w, height=h)
        except Exception as e:
            last_err = e
            time.sleep(2 ** attempt)

    if provider == "gemini":
        try:
            print(f"[image_generator] Gemini falhou, usando Pollinations: {last_err}")
            w, h = (VIDEO_WIDTH, VIDEO_HEIGHT) if aspect_ratio == "16:9" else (1080, 1920)
            fallback_cache = _cache_path(prompt, seed, "pollinations")
            if fallback_cache.exists() and fallback_cache.stat().st_size > 1000:
                return fallback_cache
            return _pollinations_generate(prompt, seed, fallback_cache, width=w, height=h)
        except Exception as e:
            last_err = e

    raise RuntimeError(f"Falha ao gerar imagem após {retries} tentativas: {last_err}")

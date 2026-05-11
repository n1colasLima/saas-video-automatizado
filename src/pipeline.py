import time
from pathlib import Path
from typing import Callable
from . import script_generator, image_generator, tts, video_assembler, youtube_reference, fashion_generator
from .config import OUTPUT_DIR, CACHE_DIR


def _slug(text: str) -> str:
    keep = "abcdefghijklmnopqrstuvwxyz0123456789-_"
    s = text.lower().replace(" ", "-")
    return "".join(c for c in s if c in keep)[:50] or "video"


def run(params: dict | None = None, progress: Callable[[str, float], None] | None = None, **kwargs) -> dict:
    p = dict(params or {})
    p.update(kwargs)

    video_type = p.get("video_type", "narrated")
    if video_type == "fashion":
        return _run_fashion(p, progress)
    return _run_narrated(p, progress)


def _run_fashion(p: dict, progress: Callable[[str, float], None] | None) -> dict:
    def report(msg: str, pct: float):
        if progress:
            progress(msg, pct)
        print(f"[fashion {pct:5.1f}%] {msg}")

    model_image = Path(p["model_image"])
    outfit_images = [Path(x) for x in p["outfit_images"]]
    scene_idea = p.get("scene_idea") or "studio backdrop, soft lighting"
    num_shots = int(p.get("num_shots", 6))
    bgm_path = Path(p["bgm_path"]) if p.get("bgm_path") else None
    title = p.get("title") or f"Fashion - {scene_idea[:40]}"

    def imgs_progress(msg, pct):
        report(msg, pct * 0.85)  # imagens consomem 85% do tempo

    shots = fashion_generator.generate_fashion_shots(
        model_image=model_image,
        outfit_images=outfit_images,
        scene_idea=scene_idea,
        num_shots=num_shots,
        aspect_ratio="9:16",
        progress=imgs_progress,
    )

    report("Montando vídeo TikTok...", 88)
    ts = int(time.time())
    out_file = OUTPUT_DIR / f"{ts}_{_slug(title)}.mp4"
    video_assembler.assemble_fashion(
        shots, out_file, bgm_path=bgm_path,
        per_shot_duration=float(p.get("shot_duration", 2.2)),
        width=1080, height=1920,
    )
    report("Pronto", 100)

    return {
        "video_path": str(out_file),
        "title": title,
        "shots": [str(s) for s in shots],
        "video_type": "fashion",
    }


def _run_narrated(p: dict, progress: Callable[[str, float], None] | None) -> dict:

    topic = p["topic"]
    num_scenes = int(p.get("num_scenes", 12))
    voice = p.get("voice")
    burn_subtitles = bool(p.get("burn_subtitles", True))
    style = p.get("style", "curiosidades")
    video_format = p.get("video_format", "16:9")
    image_provider = p.get("image_provider", "gemini")
    reference_url = p.get("reference_url", "").strip()

    def report(msg: str, pct: float):
        if progress:
            progress(msg, pct)
        print(f"[{pct:5.1f}%] {msg}")

    ts = int(time.time())
    job_dir = CACHE_DIR / f"job_{ts}"
    job_dir.mkdir(parents=True, exist_ok=True)

    reference = None
    if reference_url:
        def ref_progress(msg, pct):
            report(f"[REFERÊNCIA] {msg}", pct * 0.15)
        reference = youtube_reference.analyze_reference(reference_url, progress=ref_progress)
        report(f"Referência analisada: {reference.get('tone', '')}", 15)

    report("Gerando roteiro com Gemini...", 18)
    script = script_generator.generate_script(
        topic, num_scenes=num_scenes, style=style,
        video_format=video_format, reference=reference,
    )
    scenes = script["scenes"]
    title = script["title"]
    report(f"Roteiro: '{title}' ({len(scenes)} cenas)", 25)

    report("Gerando imagens...", 28)
    image_paths = []
    for i, scene in enumerate(scenes):
        pct = 28 + (35 * (i + 1) / len(scenes))
        report(f"Imagem {i+1}/{len(scenes)}", pct)
        path = image_generator.generate_image(
            scene["visual"], seed=1000 + i,
            aspect_ratio=video_format, provider=image_provider,
        )
        image_paths.append(path)
    report("Imagens prontas", 65)

    report("Sintetizando narração...", 68)
    audio_paths = tts.synthesize_scenes(scenes, job_dir, voice=voice)
    report("Áudios prontos", 82)

    report("Montando vídeo...", 85)
    narrations = [s["narration"] for s in scenes]
    out_file = OUTPUT_DIR / f"{ts}_{_slug(title)}.mp4"

    width, height = (1920, 1080) if video_format == "16:9" else (1080, 1920)

    video_assembler.assemble(
        image_paths, audio_paths, narrations, out_file,
        burn_subtitles=burn_subtitles, width=width, height=height,
    )
    report(f"Pronto: {out_file.name}", 100)

    return {
        "video_path": str(out_file),
        "title": title,
        "scenes": scenes,
        "job_dir": str(job_dir),
        "reference_applied": bool(reference),
    }

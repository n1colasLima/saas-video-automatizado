import asyncio
from pathlib import Path
import edge_tts
from .config import TTS_VOICE, CACHE_DIR


async def _synthesize(text: str, voice: str, out_path: Path) -> None:
    communicate = edge_tts.Communicate(text, voice, rate="+0%", pitch="+0Hz")
    await communicate.save(str(out_path))


def synthesize(text: str, out_path: Path, voice: str | None = None) -> Path:
    voice = voice or TTS_VOICE
    out_path.parent.mkdir(parents=True, exist_ok=True)
    asyncio.run(_synthesize(text, voice, out_path))
    return out_path


def synthesize_scenes(scenes: list[dict], work_dir: Path, voice: str | None = None) -> list[Path]:
    work_dir.mkdir(parents=True, exist_ok=True)
    audio_paths = []
    for i, scene in enumerate(scenes):
        path = work_dir / f"audio_{i:03d}.mp3"
        synthesize(scene["narration"], path, voice=voice)
        audio_paths.append(path)
    return audio_paths


async def list_pt_br_voices() -> list[str]:
    voices = await edge_tts.list_voices()
    return [v["ShortName"] for v in voices if v["Locale"] == "pt-BR"]

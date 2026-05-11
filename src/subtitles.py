from pathlib import Path
from groq import Groq
from .config import GROQ_API_KEY


def transcribe_to_srt(audio_path: Path, out_srt: Path) -> Path:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY não configurada no .env")

    client = Groq(api_key=GROQ_API_KEY)
    with open(audio_path, "rb") as f:
        result = client.audio.transcriptions.create(
            file=(audio_path.name, f.read()),
            model="whisper-large-v3",
            language="pt",
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )

    segments = result.segments if hasattr(result, "segments") else result["segments"]
    out_srt.write_text(_segments_to_srt(segments), encoding="utf-8")
    return out_srt


def _fmt_time(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int((t - int(t)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _segments_to_srt(segments) -> str:
    lines = []
    for i, seg in enumerate(segments, 1):
        start = seg["start"] if isinstance(seg, dict) else seg.start
        end = seg["end"] if isinstance(seg, dict) else seg.end
        text = (seg["text"] if isinstance(seg, dict) else seg.text).strip()
        lines.append(f"{i}\n{_fmt_time(start)} --> {_fmt_time(end)}\n{text}\n")
    return "\n".join(lines)

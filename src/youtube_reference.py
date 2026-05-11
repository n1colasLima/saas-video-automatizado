import base64
import json
import re
import subprocess
from pathlib import Path
from google import genai
from google.genai import types
from .config import CACHE_DIR, GEMINI_API_KEY


def _slug(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", text)[:40]
    return s.strip("_")


def download_video(url: str) -> Path:
    import yt_dlp

    work_dir = CACHE_DIR / "yt" / _slug(url)
    work_dir.mkdir(parents=True, exist_ok=True)

    ydl_opts = {
        "format": "best[height<=720][ext=mp4]/best[ext=mp4]/best",
        "outtmpl": str(work_dir / "video.%(ext)s"),
        "noplaylist": True,
        "writeinfojson": True,
        "quiet": True,
        "no_warnings": True,
        "retries": 3,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    videos = list(work_dir.glob("video.*"))
    videos = [v for v in videos if v.suffix not in (".json", ".part")]
    if not videos:
        raise RuntimeError("yt-dlp não conseguiu baixar o vídeo")
    return videos[0]


def extract_frames(video_path: Path, num_frames: int = 8) -> list[Path]:
    work_dir = video_path.parent / "frames"
    work_dir.mkdir(exist_ok=True)
    for f in work_dir.glob("*.jpg"):
        f.unlink()

    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)],
        capture_output=True, text=True, check=True,
    )
    duration = float(probe.stdout.strip())

    interval = duration / (num_frames + 1)
    frame_paths = []
    for i in range(num_frames):
        t = interval * (i + 1)
        out = work_dir / f"frame_{i:03d}.jpg"
        subprocess.run(
            ["ffmpeg", "-y", "-ss", str(t), "-i", str(video_path),
             "-frames:v", "1", "-q:v", "3", str(out)],
            check=True, capture_output=True,
        )
        frame_paths.append(out)
    return frame_paths


def extract_audio(video_path: Path) -> Path:
    out = video_path.parent / "audio.mp3"
    if out.exists():
        return out
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(video_path), "-vn",
         "-acodec", "libmp3lame", "-q:a", "4", str(out)],
        check=True, capture_output=True,
    )
    return out


def transcribe(audio_path: Path) -> str:
    cache_file = audio_path.parent / "transcript.txt"
    if cache_file.exists():
        return cache_file.read_text(encoding="utf-8")

    from faster_whisper import WhisperModel
    model = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(str(audio_path), language="pt", beam_size=1)
    text = " ".join(seg.text.strip() for seg in segments)
    cache_file.write_text(text, encoding="utf-8")
    return text


def analyze_reference(
    url: str,
    num_frames: int = 8,
    progress=None,
) -> dict:
    def step(msg, pct):
        if progress:
            progress(msg, pct)

    step("Baixando vídeo do YouTube...", 5)
    video = download_video(url)

    step("Extraindo frames-chave...", 25)
    frames = extract_frames(video, num_frames=num_frames)

    step("Extraindo áudio...", 40)
    audio = extract_audio(video)

    step("Transcrevendo narração com Whisper...", 50)
    transcript = transcribe(audio)

    info_file = video.parent / "video.info.json"
    title = ""
    description = ""
    if info_file.exists():
        info = json.loads(info_file.read_text(encoding="utf-8"))
        title = info.get("title", "")
        description = (info.get("description") or "")[:1500]

    step("Analisando estilo com Gemini...", 75)
    analysis = _gemini_analyze(title, description, transcript, frames)
    step("Análise concluída", 100)

    return {
        "title": title,
        "transcript": transcript,
        "narrative_style": analysis.get("narrative_style", ""),
        "visual_style": analysis.get("visual_style", ""),
        "tone": analysis.get("tone", ""),
        "themes": analysis.get("themes", []),
        "suggested_topic": analysis.get("suggested_topic", ""),
    }


def _gemini_analyze(title: str, description: str, transcript: str, frame_paths: list[Path]) -> dict:
    client = genai.Client(api_key=GEMINI_API_KEY)

    parts = []
    parts.append(types.Part.from_text(text=(
        "Você está analisando um vídeo do YouTube para servir de REFERÊNCIA na criação de um vídeo novo similar.\n\n"
        f"TÍTULO ORIGINAL: {title}\n\n"
        f"DESCRIÇÃO: {description}\n\n"
        f"TRANSCRIÇÃO DA NARRAÇÃO (PT-BR):\n{transcript[:6000]}\n\n"
        "Veja também os FRAMES-CHAVE anexados para entender o estilo visual.\n\n"
        "Sua tarefa: analisar e retornar APENAS um JSON neste formato exato (sem markdown):\n"
        "{\n"
        '  "narrative_style": "Descrição em PT-BR do estilo de narração: ritmo, vocabulário, tipos de gancho, estrutura",\n'
        '  "visual_style": "English description of visual style to use in image prompts: lighting, color grading, composition, mood, camera angle",\n'
        '  "tone": "Tom emocional dominante em PT-BR (ex: misterioso, descontraído, sério, etc)",\n'
        '  "themes": ["lista", "de", "temas", "principais"],\n'
        '  "suggested_topic": "Sugestão de tema similar em PT-BR para o novo vídeo (não copiar, criar variação)"\n'
        "}"
    )))

    for fp in frame_paths[:6]:
        data = fp.read_bytes()
        parts.append(types.Part.from_bytes(data=data, mime_type="image/jpeg"))

    response = client.models.generate_content(
        model="gemini-flash-latest",
        contents=[types.Content(role="user", parts=parts)],
        config=types.GenerateContentConfig(
            temperature=0.5,
            response_mime_type="application/json",
        ),
    )
    text = response.text.strip()
    text = re.sub(r"^```json\s*|\s*```$", "", text)
    return json.loads(text)

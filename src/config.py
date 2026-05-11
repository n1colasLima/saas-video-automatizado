import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
TTS_VOICE = os.getenv("TTS_VOICE", "pt-BR-AntonioNeural").strip()

OUTPUT_DIR = ROOT / "output"
CACHE_DIR = ROOT / "cache"
ASSETS_DIR = ROOT / "assets"

OUTPUT_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)
ASSETS_DIR.mkdir(exist_ok=True)

VIDEO_WIDTH = 1920
VIDEO_HEIGHT = 1080
VIDEO_FPS = 30


def check_keys() -> dict:
    return {
        "gemini": bool(GEMINI_API_KEY),
        "groq": bool(GROQ_API_KEY),
    }

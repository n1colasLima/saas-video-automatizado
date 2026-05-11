import random
from pathlib import Path
from PIL import Image

# Pillow 10+ removed Image.ANTIALIAS; MoviePy 1.0.3 still references it.
if not hasattr(Image, "ANTIALIAS"):
    Image.ANTIALIAS = Image.Resampling.LANCZOS

from moviepy.editor import (
    AudioFileClip,
    ColorClip,
    ImageClip,
    CompositeVideoClip,
    concatenate_videoclips,
    TextClip,
    CompositeAudioClip,
)
from moviepy.video.fx.all import fadein, fadeout
from .config import VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS


def _ken_burns(image_path: Path, duration: float, direction: str = "in", width: int = VIDEO_WIDTH, height: int = VIDEO_HEIGHT) -> ImageClip:
    """Animate a still image with a zoom/pan effect."""
    clip = ImageClip(str(image_path)).set_duration(duration)

    iw, ih = clip.size
    target_ratio = width / height
    src_ratio = iw / ih
    if src_ratio > target_ratio:
        new_h = height
        new_w = int(height * src_ratio)
    else:
        new_w = width
        new_h = int(width / src_ratio)
    clip = clip.resize(newsize=(new_w, new_h))

    if direction == "in":
        zoom_start, zoom_end = 1.0, 1.15
    else:
        zoom_start, zoom_end = 1.15, 1.0

    def scale(t):
        progress = t / duration
        return zoom_start + (zoom_end - zoom_start) * progress

    clip = clip.resize(lambda t: scale(t))
    clip = clip.set_position("center")

    bg = ColorClip(size=(width, height), color=(0, 0, 0), duration=duration)
    composite = CompositeVideoClip([bg, clip], size=(width, height))
    return composite.set_duration(duration)


def _make_subtitle_clip(text: str, duration: float, width: int = VIDEO_WIDTH, height: int = VIDEO_HEIGHT) -> TextClip:
    fontsize = max(34, int(width * 0.027))
    try:
        tc = TextClip(
            text, fontsize=fontsize, color="white", font="Arial-Bold",
            stroke_color="black", stroke_width=3, method="caption",
            size=(int(width * 0.85), None), align="center",
        )
    except Exception:
        tc = TextClip(
            text, fontsize=fontsize, color="white", method="caption",
            size=(int(width * 0.85), None), align="center",
        )
    return tc.set_position(("center", int(height * 0.82))).set_duration(duration)


def assemble(
    image_paths: list[Path],
    audio_paths: list[Path],
    narrations: list[str],
    out_path: Path,
    bgm_path: Path | None = None,
    burn_subtitles: bool = True,
    width: int = VIDEO_WIDTH,
    height: int = VIDEO_HEIGHT,
) -> Path:
    """Build the final video. Each scene = image (Ken Burns) + audio + optional caption."""
    scene_clips = []
    directions = ["in", "out"]
    for i, (img, aud, text) in enumerate(zip(image_paths, audio_paths, narrations)):
        audio_clip = AudioFileClip(str(aud))
        duration = max(audio_clip.duration, 1.5)

        visual = _ken_burns(img, duration, direction=random.choice(directions), width=width, height=height)
        visual = visual.set_audio(audio_clip)

        layers = [visual]
        if burn_subtitles:
            try:
                cap = _make_subtitle_clip(text, duration, width=width, height=height)
                layers.append(cap)
            except Exception:
                pass

        scene = CompositeVideoClip(layers, size=(width, height))
        scene = scene.set_duration(duration)
        if i > 0:
            scene = fadein(scene, 0.3)
        scene = fadeout(scene, 0.3)
        scene_clips.append(scene)

    final = concatenate_videoclips(scene_clips, method="compose")

    if bgm_path and Path(bgm_path).exists():
        bgm = AudioFileClip(str(bgm_path)).volumex(0.08)
        if bgm.duration < final.duration:
            from moviepy.audio.fx.all import audio_loop
            bgm = audio_loop(bgm, duration=final.duration)
        else:
            bgm = bgm.subclip(0, final.duration)
        final = final.set_audio(CompositeAudioClip([final.audio, bgm]))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    final.write_videofile(
        str(out_path),
        fps=VIDEO_FPS,
        codec="libx264",
        audio_codec="aac",
        preset="ultrafast",
        ffmpeg_params=["-crf", "23"],
        threads=8,
        verbose=False,
        logger=None,
    )
    return out_path


def assemble_fashion(
    image_paths: list[Path],
    out_path: Path,
    bgm_path: Path | None = None,
    per_shot_duration: float = 2.2,
    width: int = 1080,
    height: int = 1920,
) -> Path:
    """Fashion/TikTok mode: silent or BGM-only, short shots with quick cuts and zoom."""
    scene_clips = []
    directions = ["in", "out"]
    for i, img in enumerate(image_paths):
        duration = per_shot_duration
        visual = _ken_burns(img, duration, direction=random.choice(directions), width=width, height=height)
        if i > 0:
            visual = fadein(visual, 0.15)
        visual = fadeout(visual, 0.15)
        scene_clips.append(visual)

    final = concatenate_videoclips(scene_clips, method="compose")

    if bgm_path and Path(bgm_path).exists():
        bgm = AudioFileClip(str(bgm_path)).volumex(0.85)
        if bgm.duration < final.duration:
            from moviepy.audio.fx.all import audio_loop
            bgm = audio_loop(bgm, duration=final.duration)
        else:
            bgm = bgm.subclip(0, final.duration)
        final = final.set_audio(bgm)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    final.write_videofile(
        str(out_path),
        fps=VIDEO_FPS,
        codec="libx264",
        audio_codec="aac" if bgm_path else None,
        preset="ultrafast",
        ffmpeg_params=["-crf", "23"],
        threads=8,
        verbose=False,
        logger=None,
    )
    return out_path

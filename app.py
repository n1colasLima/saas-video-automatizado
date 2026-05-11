import asyncio
import json
import time
from datetime import datetime
from pathlib import Path

import gradio as gr

from src import config, job_queue, pipeline, tts


# ---------------------------------------------------------------------------
# Worker bootstrap
# ---------------------------------------------------------------------------
job_queue.start_worker(runner=pipeline.run)


def _voice_choices() -> list[str]:
    try:
        return asyncio.run(tts.list_pt_br_voices())
    except Exception:
        return ["pt-BR-AntonioNeural", "pt-BR-FranciscaNeural", "pt-BR-ThalitaNeural"]


VOICES = _voice_choices()

STYLES = [
    ("Curiosidades", "curiosidades"),
    ("Mistérios", "misterios"),
    ("História", "historia"),
    ("Ciência", "ciencia"),
    ("Tops / Listas", "tops"),
]

FORMATS = [
    ("Horizontal · YouTube · 16:9", "16:9"),
    ("Vertical · Shorts/Reels · 9:16", "9:16"),
]

IMAGE_PROVIDERS = [
    ("Gemini Image · Premium", "gemini"),
    ("Pollinations · Grátis", "pollinations"),
]


# ---------------------------------------------------------------------------
# CSS - Sidebar dashboard, full bleed, cinema dark
# ---------------------------------------------------------------------------
CSS = """
@import url('https://fonts.googleapis.com/css2?family=Fira+Sans:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500;600&display=swap');

/* ============== Reset Gradio ============== */
.gradio-container, gradio-app, body {
    font-family: 'Fira Sans', -apple-system, sans-serif !important;
    background: #07070D !important;
    color: #F8FAFC !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
}
.gradio-container > .main, .main {
    max-width: 100% !important;
    padding: 0 !important;
}
footer, .footer { display: none !important; }
.gradio-container .prose { color: #F8FAFC !important; }

/* ============== Shell: sidebar + content ============== */
.va-shell { display: flex !important; min-height: 100vh; gap: 0 !important; }
.va-sidebar {
    width: 240px !important;
    min-width: 240px !important;
    max-width: 240px !important;
    flex-shrink: 0 !important;
    background: linear-gradient(180deg, #0F0F23 0%, #08081A 100%);
    border-right: 1px solid rgba(255,255,255,0.06);
    padding: 28px 18px !important;
    position: sticky; top: 0; height: 100vh;
    display: flex !important;
    flex-direction: column !important;
    gap: 0 !important;
}
.va-sidebar > * { width: 100% !important; }
.va-content {
    flex: 1;
    padding: 32px 48px 64px 48px;
    background: radial-gradient(ellipse at top left, rgba(225,29,72,0.06) 0%, transparent 50%), #07070D;
    min-height: 100vh;
    overflow-y: auto;
}

/* Sidebar brand */
.va-brand {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 10px 28px 10px; margin-bottom: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
.va-brand-mark {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #E11D48 0%, #BE123C 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(225,29,72,0.4);
    font-family: 'Fira Code', monospace; font-weight: 700; color: white;
    font-size: 18px;
}
.va-brand-text { font-weight: 700; font-size: 15px; letter-spacing: -0.3px; }
.va-brand-sub { font-size: 11px; color: #64748B; font-family: 'Fira Code', monospace; }

/* Nav (we use a Radio styled as nav) */
.va-nav-label { font-size: 11px; font-weight: 600; letter-spacing: 1.5px;
    text-transform: uppercase; color: #475569; padding: 0 10px; margin: 16px 0 8px 0; }

.va-nav, .va-nav > div, .va-nav .gr-form, .va-nav .gr-radio,
.va-nav fieldset, .va-nav .wrap, .va-nav .form {
    background: transparent !important; border: none !important;
    padding: 0 !important; margin: 0 !important;
    box-shadow: none !important;
}
.va-nav .wrap, .va-nav fieldset > .wrap, .va-nav [data-testid="radio"] {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 4px !important;
    width: 100% !important;
}
.va-nav input[type="radio"] { display: none !important; }
.va-nav label {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 12px !important;
    width: 100% !important;
    box-sizing: border-box !important;
    padding: 11px 14px !important;
    border-radius: 10px !important;
    color: #94A3B8 !important;
    font-weight: 500 !important;
    font-size: 14px !important;
    cursor: pointer;
    transition: all 200ms ease;
    background: transparent !important;
    border: 3px solid transparent !important;
    border-left-width: 3px !important;
    margin: 0 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
}
.va-nav label > span:not(.va-nav label > span:first-child) {
    background: transparent !important;
    color: inherit !important;
    font-size: inherit !important;
    font-weight: inherit !important;
    padding: 0 !important;
    border: none !important;
}
.va-nav label:hover {
    background: rgba(255,255,255,0.03) !important;
    color: #F8FAFC !important;
}
.va-nav label:has(input:checked) {
    background: rgba(225,29,72,0.12) !important;
    color: #FB7185 !important;
    border-left-color: #E11D48 !important;
    font-weight: 600 !important;
}

/* Sidebar footer (no absolute — flows under nav) */
.va-sidebar-footer {
    margin-top: auto;
    padding: 14px; border-radius: 10px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
    font-size: 11px; color: #64748B;
    line-height: 1.5;
}
.va-sidebar-footer strong { color: #94A3B8; display: block; margin-bottom: 4px; font-weight: 600; }

/* ============== Page Header ============== */
.va-page-header { margin-bottom: 32px; }
.va-page-eyebrow {
    font-size: 11px; color: #E11D48; font-weight: 700; letter-spacing: 2px;
    text-transform: uppercase; font-family: 'Fira Code', monospace; margin-bottom: 8px;
}
.va-page-title {
    font-size: 36px; font-weight: 800; letter-spacing: -1.2px;
    line-height: 1.05; margin: 0 0 8px 0;
    background: linear-gradient(135deg, #F8FAFC 0%, #94A3B8 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.va-page-sub { color: #94A3B8; font-size: 15px; line-height: 1.5; max-width: 720px; }

/* ============== Cards / Panels ============== */
.va-card {
    background: linear-gradient(180deg, rgba(30,27,75,0.4) 0%, rgba(15,15,35,0.6) 100%) !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 16px !important;
    padding: 24px !important;
    backdrop-filter: blur(20px);
    margin-bottom: 14px !important;
}
/* Group wrappers around step content shouldn't add their own background */
.gradio-container .form,
.gradio-container .gr-group,
.gradio-container fieldset.block {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
}
/* Step Group wrappers (containers) */
.gradio-container .gr-group:not(.va-card) > .gr-form,
.gradio-container [data-testid="group"] {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
}
.va-card-title {
    font-size: 12px; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase; color: #94A3B8; margin-bottom: 16px;
    padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
}

/* ============== Metrics ============== */
.va-metrics { display: grid !important; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
.va-metric {
    background: linear-gradient(180deg, rgba(30,27,75,0.3) 0%, rgba(15,15,35,0.5) 100%);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px;
    transition: all 250ms ease;
}
.va-metric:hover { border-color: rgba(225,29,72,0.3); transform: translateY(-2px); }
.va-metric-label { font-size: 11px; color: #64748B; font-weight: 600;
    letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; }
.va-metric-value { font-size: 32px; font-weight: 800; color: #F8FAFC;
    font-family: 'Fira Code', monospace; letter-spacing: -1px; }
.va-metric-delta { font-size: 12px; margin-top: 4px; }
.va-metric-delta.up { color: #22C55E; }
.va-metric-delta.muted { color: #475569; }

/* ============== Wizard steps ============== */
.va-stepper { display: flex; gap: 0; margin-bottom: 32px; padding: 0;
    background: transparent !important; border: none !important; }
.va-step {
    flex: 1; padding: 14px 16px; position: relative;
    border-bottom: 2px solid rgba(255,255,255,0.08);
    transition: all 200ms ease;
}
.va-step.active { border-bottom-color: #E11D48; }
.va-step.done { border-bottom-color: #22C55E; }
.va-step-num { font-family: 'Fira Code', monospace; font-size: 11px;
    color: #475569; font-weight: 600; letter-spacing: 1px; }
.va-step.active .va-step-num { color: #FB7185; }
.va-step.done .va-step-num { color: #22C55E; }
.va-step-name { font-size: 14px; font-weight: 600; color: #94A3B8; margin-top: 4px; }
.va-step.active .va-step-name { color: #F8FAFC; }
.va-step.done .va-step-name { color: #F8FAFC; }

/* ============== Form inputs ============== */
.gradio-container .label-wrap > span,
.gradio-container .block-title,
.gradio-container .gr-form > label > span:first-child {
    color: #CBD5E1 !important; font-weight: 500 !important; font-size: 13px !important;
    background: transparent !important; border: none !important;
}
.gradio-container input[type="text"],
.gradio-container input[type="number"],
.gradio-container textarea,
.gradio-container select,
.gradio-container .gr-textbox textarea,
.gradio-container .gr-textbox input {
    background: rgba(15,15,35,0.6) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 10px !important; color: #F8FAFC !important;
    font-family: 'Fira Sans', sans-serif !important; font-size: 15px !important;
    transition: all 200ms ease !important;
}
.gradio-container input:focus, .gradio-container textarea:focus {
    border-color: #E11D48 !important;
    box-shadow: 0 0 0 3px rgba(225,29,72,0.15) !important; outline: none !important;
}
.gradio-container input[type="range"] { accent-color: #E11D48 !important; }
.gradio-container input[type="checkbox"] { accent-color: #E11D48 !important; }

/* Radio cards for step selectors */
.va-choice-cards,
.va-choice-cards > *,
.va-choice-cards fieldset,
.va-choice-cards .gr-form,
.va-choice-cards .gr-radio {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    box-shadow: none !important;
}
.va-choice-cards .wrap,
.va-choice-cards fieldset > .wrap,
.va-choice-cards [data-testid="radio"] {
    display: grid !important;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important;
    gap: 12px !important;
    width: 100% !important;
    background: transparent !important;
}
.va-choice-cards input[type="radio"] {
    position: absolute !important;
    opacity: 0 !important;
    pointer-events: none !important;
}
.va-choice-cards label {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    background: rgba(15,15,35,0.6) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 12px !important;
    padding: 18px 20px !important;
    cursor: pointer !important;
    transition: all 200ms ease !important;
    color: #CBD5E1 !important;
    font-weight: 500 !important;
    font-size: 14px !important;
    min-height: 56px !important;
    box-sizing: border-box !important;
}
.va-choice-cards label > span,
.va-choice-cards label > * {
    color: inherit !important;
    background: transparent !important;
    font-size: inherit !important;
    font-weight: inherit !important;
    padding: 0 !important;
    border: none !important;
}
.va-choice-cards label:hover {
    border-color: rgba(225,29,72,0.4) !important;
    transform: translateY(-1px);
}
.va-choice-cards label:has(input:checked) {
    background: linear-gradient(135deg, rgba(225,29,72,0.15), rgba(30,27,75,0.4)) !important;
    border-color: #E11D48 !important;
    box-shadow: 0 8px 24px rgba(225,29,72,0.2);
    color: #F8FAFC !important;
}

/* ============== Buttons ============== */
.gradio-container button.primary, button.va-btn-primary {
    background: linear-gradient(135deg, #E11D48 0%, #BE123C 100%) !important;
    border: none !important; border-radius: 11px !important;
    color: white !important; font-family: 'Fira Sans', sans-serif !important;
    font-weight: 700 !important; font-size: 15px !important;
    padding: 14px 22px !important; cursor: pointer !important;
    transition: all 200ms ease !important;
    box-shadow: 0 4px 16px rgba(225,29,72,0.35), inset 0 1px 0 rgba(255,255,255,0.15) !important;
}
.gradio-container button.primary:hover {
    box-shadow: 0 6px 24px rgba(225,29,72,0.5) !important; filter: brightness(1.05);
}
.gradio-container button.secondary, button.va-btn-secondary {
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    color: #F8FAFC !important; border-radius: 11px !important;
    font-weight: 600 !important; padding: 14px 22px !important;
}
.gradio-container button.secondary:hover { background: rgba(255,255,255,0.08) !important; }

/* ============== Video list ============== */
.va-video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.va-video-item {
    background: rgba(15,15,35,0.5); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; overflow: hidden; transition: all 250ms ease;
}
.va-video-item:hover { border-color: rgba(225,29,72,0.4); transform: translateY(-2px); }
.va-video-thumb { aspect-ratio: 16/9; background: #000;
    display: flex; align-items: center; justify-content: center; }
.va-video-meta { padding: 14px 16px; }
.va-video-title { font-weight: 600; font-size: 14px; margin-bottom: 4px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.va-video-time { font-size: 11px; color: #64748B; font-family: 'Fira Code', monospace; }
.va-empty {
    border: 1px dashed rgba(255,255,255,0.1); border-radius: 14px;
    padding: 56px 24px; text-align: center; color: #64748B;
}
.va-empty-title { font-size: 16px; color: #94A3B8; font-weight: 600; margin-bottom: 6px; }

/* ============== Queue ============== */
.va-queue { display: flex; flex-direction: column; gap: 10px; }
.va-queue-item {
    display: grid; grid-template-columns: auto 1fr auto auto;
    gap: 16px; align-items: center;
    background: rgba(15,15,35,0.5); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 14px 18px;
}
.va-queue-id { font-family: 'Fira Code', monospace; color: #475569; font-size: 12px; }
.va-queue-title { font-weight: 600; }
.va-queue-status {
    padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Fira Code', monospace;
}
.va-queue-status.queued { background: rgba(148,163,184,0.15); color: #94A3B8; }
.va-queue-status.running { background: rgba(245,158,11,0.15); color: #F59E0B; }
.va-queue-status.done { background: rgba(34,197,94,0.15); color: #22C55E; }
.va-queue-status.failed { background: rgba(239,68,68,0.15); color: #EF4444; }
.va-queue-prog {
    width: 100px; height: 6px; background: rgba(255,255,255,0.06);
    border-radius: 999px; overflow: hidden;
}
.va-queue-prog > div {
    height: 100%; background: linear-gradient(90deg, #E11D48, #FB7185);
    transition: width 300ms ease;
}

/* Markdown content within content */
.va-content .markdown, .va-content .markdown p { color: #CBD5E1 !important; }
.va-content .markdown h3 { color: #F8FAFC !important; }
.va-content .markdown code {
    background: rgba(225,29,72,0.12) !important; color: #FB7185 !important;
    padding: 2px 8px !important; border-radius: 6px !important;
    font-family: 'Fira Code', monospace !important;
}

/* Hide gradio "Drop video" placeholder when empty */
.gradio-container video { border-radius: 12px !important; background: #000 !important; }

/* Preset chips for fashion scenes */
.va-preset-chip { flex: 0 0 auto !important; }
.va-preset-chip button {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    color: #CBD5E1 !important;
    padding: 8px 14px !important;
    font-size: 13px !important;
    border-radius: 999px !important;
    font-weight: 500 !important;
    transition: all 200ms ease !important;
    box-shadow: none !important;
}
.va-preset-chip button:hover {
    background: rgba(225,29,72,0.15) !important;
    border-color: rgba(225,29,72,0.4) !important;
    color: #FB7185 !important;
}

/* File upload area styling */
.gradio-container .upload-container,
.gradio-container [data-testid="file"] {
    background: rgba(15,15,35,0.6) !important;
    border: 2px dashed rgba(255,255,255,0.15) !important;
    border-radius: 12px !important;
    transition: all 200ms ease !important;
}
.gradio-container [data-testid="file"]:hover {
    border-color: rgba(225,29,72,0.4) !important;
    background: rgba(225,29,72,0.05) !important;
}
"""


# ---------------------------------------------------------------------------
# Renderers
# ---------------------------------------------------------------------------
def render_metrics_html() -> str:
    m = job_queue.get_metrics()
    return f"""
    <div class="va-metrics">
      <div class="va-metric">
        <div class="va-metric-label">Total de jobs</div>
        <div class="va-metric-value">{m['total']}</div>
        <div class="va-metric-delta muted">desde o início</div>
      </div>
      <div class="va-metric">
        <div class="va-metric-label">Em fila</div>
        <div class="va-metric-value">{m['queued']}</div>
        <div class="va-metric-delta muted">aguardando</div>
      </div>
      <div class="va-metric">
        <div class="va-metric-label">Em geração</div>
        <div class="va-metric-value">{m['running']}</div>
        <div class="va-metric-delta {'up' if m['running'] else 'muted'}">processando agora</div>
      </div>
      <div class="va-metric">
        <div class="va-metric-label">Concluídos</div>
        <div class="va-metric-value">{m['done']}</div>
        <div class="va-metric-delta up">{m['failed']} falhas</div>
      </div>
    </div>
    """


def render_videos_html() -> str:
    vids = job_queue.list_completed_videos(limit=24)
    if not vids:
        return """
        <div class="va-empty">
          <div class="va-empty-title">Nenhum vídeo gerado ainda</div>
          <div>Clique em <strong>Novo vídeo</strong> na barra lateral para começar.</div>
        </div>
        """
    cards = []
    for v in vids:
        title = (v.get("title") or "Sem título").replace("<", "&lt;")
        path = v.get("video_path") or ""
        fname = Path(path).name if path else ""
        when = v.get("updated_at", "")[:19].replace("T", " ")
        cards.append(f"""
        <div class="va-video-item">
          <div class="va-video-thumb">
            <video src="/gradio_api/file={path}" controls preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>
          </div>
          <div class="va-video-meta">
            <div class="va-video-title">{title}</div>
            <div class="va-video-time">#{v['id']} · {when}</div>
          </div>
        </div>
        """)
    return f'<div class="va-video-grid">{"".join(cards)}</div>'


def render_queue_html() -> str:
    jobs = job_queue.list_jobs(limit=30)
    if not jobs:
        return '<div class="va-empty"><div class="va-empty-title">A fila está vazia</div></div>'
    items = []
    for j in jobs:
        params = json.loads(j["params_json"])
        title = j.get("title") or params.get("topic") or "Sem título"
        title = title[:80].replace("<", "&lt;")
        status = j["status"]
        prog = j.get("progress") or 0
        msg = j.get("progress_msg") or ""
        items.append(f"""
        <div class="va-queue-item">
          <div class="va-queue-id">#{j['id']:04d}</div>
          <div>
            <div class="va-queue-title">{title}</div>
            <div style="font-size:12px;color:#64748B;margin-top:2px;">{msg}</div>
          </div>
          <div class="va-queue-prog"><div style="width:{prog}%;"></div></div>
          <div class="va-queue-status {status}">{status}</div>
        </div>
        """)
    return f'<div class="va-queue">{"".join(items)}</div>'


def render_step_indicator(active_step: int, total: int = 5) -> str:
    names = ["Estilo", "Tema", "Formato", "Voz", "Confirmar"]
    cells = []
    for i in range(total):
        cls = "active" if i == active_step else ("done" if i < active_step else "")
        cells.append(f"""
        <div class="va-step {cls}">
          <div class="va-step-num">PASSO {i+1:02d}</div>
          <div class="va-step-name">{names[i]}</div>
        </div>
        """)
    return f'<div class="va-stepper">{"".join(cells)}</div>'


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------
def submit_job(style, topic, video_format, image_provider, voice, num_scenes, burn_subs, reference_url):
    if not topic or not topic.strip():
        raise gr.Error("Informe um tema na etapa 2.")
    if not config.check_keys()["gemini"]:
        raise gr.Error("GEMINI_API_KEY não configurada no .env")
    params = {
        "video_type": "narrated",
        "topic": topic.strip(),
        "style": style,
        "video_format": video_format,
        "image_provider": image_provider,
        "voice": voice,
        "num_scenes": int(num_scenes),
        "burn_subtitles": bool(burn_subs),
        "reference_url": (reference_url or "").strip(),
    }
    job_id = job_queue.enqueue(params)
    return job_id


# Predefined scene presets for fashion mode (shown as clickable chips)
FASHION_SCENE_PRESETS = [
    ("Closet", "luxurious walk-in closet with soft warm lighting, mirrors, hanging clothes in the background, polished wooden floor, vertical 9:16 framing"),
    ("Academia", "modern gym interior, rubber flooring, weight racks and machines softly out of focus in the background, dramatic sidelight, vertical 9:16 framing"),
    ("Quarto", "modern bedroom with neutral tones, large window with soft natural daylight, minimalist bed, vertical 9:16 framing"),
    ("Rua urbana", "trendy urban street, soft golden hour sunlight, blurred passersby and city buildings in the background, vertical 9:16 framing"),
    ("Café", "stylish modern coffee shop interior, warm pendant lights, blurred patrons in background, big windows, vertical 9:16 framing"),
    ("Praia", "beach at golden hour, soft sand, gentle waves in the background, warm sunlight, vertical 9:16 framing"),
    ("Estúdio neutro", "professional fashion photography studio, seamless neutral gray backdrop, soft umbrella lighting, vertical 9:16 framing"),
    ("Rooftop", "rooftop terrace with city skyline at sunset behind, warm bokeh lights, vertical 9:16 framing"),
]


def submit_fashion_job(model_file, outfit_files, scene_idea, num_shots, shot_duration, bgm_file, title):
    if not model_file:
        raise gr.Error("Envie uma foto da modelo (passo 1).")
    if not outfit_files:
        raise gr.Error("Envie ao menos uma foto da roupa (passo 2).")
    if not scene_idea or not scene_idea.strip():
        raise gr.Error("Descreva o cenário/contexto (passo 3).")
    if not config.check_keys()["gemini"]:
        raise gr.Error("GEMINI_API_KEY não configurada no .env")

    # gradio File component returns file path string in Gradio 6
    model_path = model_file if isinstance(model_file, str) else model_file.name
    outfit_paths = [(f if isinstance(f, str) else f.name) for f in outfit_files]
    bgm_path = (bgm_file if isinstance(bgm_file, str) else bgm_file.name) if bgm_file else None

    params = {
        "video_type": "fashion",
        "model_image": model_path,
        "outfit_images": outfit_paths,
        "scene_idea": scene_idea.strip(),
        "num_shots": int(num_shots),
        "shot_duration": float(shot_duration),
        "bgm_path": bgm_path,
        "title": (title or "").strip() or f"Fashion · {scene_idea[:40]}",
    }
    return job_queue.enqueue(params)


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------
HOME_HEADER = """
<div class="va-page-header">
  <div class="va-page-eyebrow">DASHBOARD</div>
  <h1 class="va-page-title">Bem-vindo de volta.</h1>
  <p class="va-page-sub">Gere vídeos completos de forma autônoma. Acompanhe a fila e revise seus vídeos prontos em um só lugar.</p>
</div>
"""

CREATE_HEADER = """
<div class="va-page-header">
  <div class="va-page-eyebrow">NOVO VÍDEO</div>
  <h1 class="va-page-title">Configurar geração.</h1>
  <p class="va-page-sub">Cinco passos rápidos. Depois de enfileirar, o worker processa em segundo plano enquanto você programa o próximo.</p>
</div>
"""

QUEUE_HEADER = """
<div class="va-page-header">
  <div class="va-page-eyebrow">FILA</div>
  <h1 class="va-page-title">Geração em andamento.</h1>
  <p class="va-page-sub">Acompanhe em tempo real o progresso dos vídeos em produção.</p>
</div>
"""

LIBRARY_HEADER = """
<div class="va-page-header">
  <div class="va-page-eyebrow">BIBLIOTECA</div>
  <h1 class="va-page-title">Seus vídeos.</h1>
  <p class="va-page-sub">Reproduza ou baixe os MP4s gerados. Os arquivos ficam em <code>output/</code>.</p>
</div>
"""

FASHION_HEADER = """
<div class="va-page-header">
  <div class="va-page-eyebrow">TIKTOK SHOP · MODA</div>
  <h1 class="va-page-title">Modelo + roupa + cenário.</h1>
  <p class="va-page-sub">Suba uma foto da modelo e das roupas. A IA gera múltiplas imagens dela vestindo a roupa em poses naturais e monta em um vídeo vertical 9:16.</p>
</div>
"""


def render_fashion_step_indicator(active_step: int, total: int = 4) -> str:
    names = ["Modelo", "Roupa", "Cenário", "Confirmar"]
    cells = []
    for i in range(total):
        cls = "active" if i == active_step else ("done" if i < active_step else "")
        cells.append(f"""
        <div class="va-step {cls}">
          <div class="va-step-num">PASSO {i+1:02d}</div>
          <div class="va-step-name">{names[i]}</div>
        </div>
        """)
    return f'<div class="va-stepper">{"".join(cells)}</div>'

SIDEBAR_HTML = """
<div class="va-brand">
  <div class="va-brand-mark">VA</div>
  <div>
    <div class="va-brand-text">Video Auto</div>
    <div class="va-brand-sub">pipeline · v2.0</div>
  </div>
</div>
<div class="va-nav-label">Navegação</div>
"""

SIDEBAR_FOOTER = """
<div class="va-sidebar-footer">
  <strong>Pipeline ativo</strong>
  Worker assíncrono em execução. Vídeos da fila são processados automaticamente.
</div>
"""


with gr.Blocks(title="Video Auto", css=CSS, theme=gr.themes.Base(
    primary_hue="rose", neutral_hue="slate",
    font=[gr.themes.GoogleFont("Fira Sans"), "sans-serif"],
    font_mono=[gr.themes.GoogleFont("Fira Code"), "monospace"],
)) as demo:

    with gr.Row(elem_classes=["va-shell"], equal_height=False):
        # ============ SIDEBAR ============
        with gr.Column(elem_classes=["va-sidebar"], scale=0, min_width=240):
            gr.HTML(SIDEBAR_HTML)
            nav = gr.Radio(
                choices=["Início", "Vídeo narrado", "TikTok / Moda", "Fila", "Biblioteca"],
                value="Início", show_label=False, container=False,
                elem_classes=["va-nav"],
            )
            gr.HTML(SIDEBAR_FOOTER)

        # ============ CONTENT ============
        with gr.Column(elem_classes=["va-content"], scale=1):

            # -------- HOME --------
            with gr.Column(visible=True) as page_home:
                gr.HTML(HOME_HEADER)
                metrics_html = gr.HTML(render_metrics_html())
                with gr.Row():
                    new_narrated_btn = gr.Button("Novo vídeo narrado", variant="primary", size="lg")
                    new_fashion_btn = gr.Button("Novo TikTok / Moda", variant="primary", size="lg")
                    refresh_home_btn = gr.Button("Atualizar", variant="secondary", size="lg")
                gr.HTML('<div style="height:24px;"></div>')
                gr.Markdown("### Vídeos recentes")
                videos_html = gr.HTML(render_videos_html())

            # -------- CREATE WIZARD --------
            with gr.Column(visible=False) as page_create:
                gr.HTML(CREATE_HEADER)
                step_indicator = gr.HTML(render_step_indicator(0))

                # state for wizard
                style_val = gr.State("curiosidades")
                topic_val = gr.State("")
                format_val = gr.State("16:9")
                provider_val = gr.State("gemini")
                voice_val = gr.State(config.TTS_VOICE)
                scenes_val = gr.State(12)
                burnsubs_val = gr.State(True)
                reference_val = gr.State("")
                step_state = gr.State(0)
                created_job = gr.State(None)

                # ----- Step 0: Style -----
                with gr.Group(visible=True) as step0:
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Escolha o estilo do conteúdo</div>')
                        s0_choice = gr.Radio(
                            choices=[(label, val) for label, val in STYLES],
                            value="curiosidades", show_label=False,
                            container=False, elem_classes=["va-choice-cards"],
                        )
                    with gr.Row():
                        s0_back = gr.Button("Cancelar", variant="secondary")
                        s0_next = gr.Button("Continuar →", variant="primary")

                # ----- Step 1: Topic + reference -----
                with gr.Group(visible=False) as step1:
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Tema do vídeo</div>')
                        s1_topic = gr.Textbox(
                            placeholder="Ex.: 7 mistérios não resolvidos da Amazônia brasileira",
                            label="Sobre o que será o vídeo?", lines=3,
                        )
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Referência (opcional)</div>')
                        s1_ref = gr.Textbox(
                            placeholder="https://www.youtube.com/watch?v=...",
                            label="URL de vídeo do YouTube como inspiração",
                            info="O sistema baixa, transcreve e analisa o estilo visual + narrativo para inspirar o novo vídeo (não copia).",
                        )
                    with gr.Row():
                        s1_back = gr.Button("← Voltar", variant="secondary")
                        s1_next = gr.Button("Continuar →", variant="primary")

                # ----- Step 2: Format + image provider -----
                with gr.Group(visible=False) as step2:
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Formato do vídeo</div>')
                        s2_format = gr.Radio(
                            choices=[(label, val) for label, val in FORMATS],
                            value="16:9", show_label=False,
                            container=False, elem_classes=["va-choice-cards"],
                        )
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Gerador de imagens</div>')
                        s2_provider = gr.Radio(
                            choices=[(label, val) for label, val in IMAGE_PROVIDERS],
                            value="gemini", show_label=False,
                            container=False, elem_classes=["va-choice-cards"],
                        )
                        gr.HTML('<div style="font-size:12px;color:#64748B;margin-top:8px;">Gemini Image entrega qualidade cinematográfica (pago). Pollinations é grátis.</div>')
                    with gr.Row():
                        s2_back = gr.Button("← Voltar", variant="secondary")
                        s2_next = gr.Button("Continuar →", variant="primary")

                # ----- Step 3: Voice + scenes -----
                with gr.Group(visible=False) as step3:
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Narração e duração</div>')
                        s3_voice = gr.Dropdown(
                            choices=VOICES, value=config.TTS_VOICE,
                            label="Voz da narração",
                            info="Vozes neurais Microsoft Edge — gratuito",
                        )
                        s3_scenes = gr.Slider(
                            6, 20, value=12, step=1, label="Número de cenas",
                            info="Cada cena vira uma imagem + narração de 1–3 frases",
                        )
                        s3_subs = gr.Checkbox(
                            value=True, label="Queimar legendas no vídeo",
                            info="Sobrepõe texto da narração",
                        )
                    with gr.Row():
                        s3_back = gr.Button("← Voltar", variant="secondary")
                        s3_next = gr.Button("Continuar →", variant="primary")

                # ----- Step 4: Confirm -----
                with gr.Group(visible=False) as step4:
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Revisar e enviar para fila</div>')
                        summary_md = gr.Markdown()
                    with gr.Row():
                        s4_back = gr.Button("← Voltar", variant="secondary")
                        s4_submit = gr.Button("Enviar para a fila", variant="primary")
                    success_html = gr.HTML(visible=False)

            # -------- CREATE FASHION WIZARD --------
            with gr.Column(visible=False) as page_create_fashion:
                gr.HTML(FASHION_HEADER)
                f_step_indicator = gr.HTML(render_fashion_step_indicator(0))

                # State for fashion wizard
                f_model_val = gr.State(None)
                f_outfits_val = gr.State([])
                f_scene_val = gr.State("")
                f_shots_val = gr.State(6)
                f_duration_val = gr.State(2.2)
                f_bgm_val = gr.State(None)
                f_title_val = gr.State("")
                f_step_state = gr.State(0)

                # ----- Fashion Step 0: Model -----
                with gr.Group(visible=True) as f_step0:
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Foto da modelo</div>')
                        gr.Markdown("Suba uma foto **bem iluminada, de corpo inteiro de preferência**, mostrando o rosto e o tipo físico da modelo. Essa será a referência de identidade em todas as imagens geradas.")
                        f_model_file = gr.File(
                            label="Foto da modelo (JPG/PNG)",
                            file_types=["image"],
                            file_count="single",
                            height=180,
                        )
                    with gr.Row():
                        f_s0_back = gr.Button("Cancelar", variant="secondary")
                        f_s0_next = gr.Button("Continuar →", variant="primary")

                # ----- Fashion Step 1: Outfit -----
                with gr.Group(visible=False) as f_step1:
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Foto(s) da roupa</div>')
                        gr.Markdown("Suba uma ou mais fotos da peça que a modelo deve vestir (frente, costas, detalhes). Quanto mais clara a roupa nas fotos, melhor o resultado.")
                        f_outfit_files = gr.File(
                            label="Fotos da roupa (até 5)",
                            file_types=["image"],
                            file_count="multiple",
                            height=180,
                        )
                    with gr.Row():
                        f_s1_back = gr.Button("← Voltar", variant="secondary")
                        f_s1_next = gr.Button("Continuar →", variant="primary")

                # ----- Fashion Step 2: Scene -----
                with gr.Group(visible=False) as f_step2:
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Cenário e estilo</div>')
                        gr.Markdown("Descreva o cenário e o que você quer no vídeo. Pode clicar em uma das sugestões abaixo para preencher.")
                        f_scene_text = gr.Textbox(
                            label="Descrição do cenário",
                            placeholder="Ex.: modelo em uma academia moderna, vestindo a calça legging, mostrando o ajuste no quadril, iluminação dramática",
                            lines=4,
                        )
                        with gr.Row():
                            f_preset_chips = [
                                gr.Button(label, variant="secondary", size="sm", elem_classes=["va-preset-chip"])
                                for label, _ in FASHION_SCENE_PRESETS
                            ]
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Parâmetros do vídeo</div>')
                        f_title = gr.Textbox(
                            label="Título do vídeo (opcional)",
                            placeholder="Ex.: Legging preta - coleção verão",
                        )
                        f_num_shots = gr.Slider(
                            4, 12, value=6, step=1, label="Número de imagens",
                            info="Cada imagem ~$0.04 no Gemini. 6 imagens × 2.2s = vídeo de ~13s",
                        )
                        f_shot_duration = gr.Slider(
                            1.0, 4.0, value=2.2, step=0.1, label="Duração por imagem (s)",
                            info="TikTok funciona bem com cortes rápidos de 1.5–2.5s",
                        )
                        f_bgm_file = gr.File(
                            label="Trilha sonora (MP3 opcional)",
                            file_types=["audio"],
                            file_count="single",
                            height=140,
                        )
                    with gr.Row():
                        f_s2_back = gr.Button("← Voltar", variant="secondary")
                        f_s2_next = gr.Button("Revisar →", variant="primary")

                # ----- Fashion Step 3: Confirm -----
                with gr.Group(visible=False) as f_step3:
                    with gr.Column(elem_classes=["va-card"]):
                        gr.HTML('<div class="va-card-title">Revisar e enviar para fila</div>')
                        f_summary = gr.Markdown()
                    with gr.Row():
                        f_s3_back = gr.Button("← Voltar", variant="secondary")
                        f_s3_submit = gr.Button("Enviar para a fila", variant="primary")
                    f_success_html = gr.HTML(visible=False)

            # -------- QUEUE --------
            with gr.Column(visible=False) as page_queue:
                gr.HTML(QUEUE_HEADER)
                queue_html = gr.HTML(render_queue_html())
                refresh_queue_btn = gr.Button("Atualizar fila", variant="secondary")
                gr.HTML('<div style="margin-top:8px;font-size:12px;color:#64748B;">A fila atualiza automaticamente a cada 3 segundos.</div>')

            # -------- LIBRARY --------
            with gr.Column(visible=False) as page_library:
                gr.HTML(LIBRARY_HEADER)
                lib_html = gr.HTML(render_videos_html())
                refresh_lib_btn = gr.Button("Atualizar biblioteca", variant="secondary")

    # ====================================================================
    # Wiring
    # ====================================================================
    pages = [page_home, page_create, page_create_fashion, page_queue, page_library]
    steps = [step0, step1, step2, step3, step4]
    f_steps = [f_step0, f_step1, f_step2, f_step3]

    PAGE_INDEX = {"Início": 0, "Vídeo narrado": 1, "TikTok / Moda": 2, "Fila": 3, "Biblioteca": 4}

    def show_step(n: int):
        return [gr.update(visible=(i == n)) for i in range(5)] + [render_step_indicator(n), n]

    def show_fashion_step(n: int):
        return [gr.update(visible=(i == n)) for i in range(4)] + [render_fashion_step_indicator(n), n]

    def switch_page(choice):
        idx = PAGE_INDEX.get(choice, 0)
        page_updates = [gr.update(visible=(i == idx)) for i in range(5)]
        # Reset narrated wizard when entering it
        narr_step_updates = [gr.update(visible=(i == 0)) for i in range(5)] if idx == 1 else [gr.update() for _ in range(5)]
        # Reset fashion wizard when entering it
        fash_step_updates = [gr.update(visible=(i == 0)) for i in range(4)] if idx == 2 else [gr.update() for _ in range(4)]
        return page_updates + narr_step_updates + fash_step_updates + [
            render_step_indicator(0) if idx == 1 else gr.update(),
            0 if idx == 1 else gr.update(),
            render_fashion_step_indicator(0) if idx == 2 else gr.update(),
            0 if idx == 2 else gr.update(),
            render_metrics_html() if idx == 0 else gr.update(),
            render_videos_html() if idx == 0 else gr.update(),
            render_queue_html() if idx == 3 else gr.update(),
            render_videos_html() if idx == 4 else gr.update(),
        ]

    nav.change(switch_page, [nav],
               [*pages, *steps, *f_steps,
                step_indicator, step_state,
                f_step_indicator, f_step_state,
                metrics_html, videos_html, queue_html, lib_html])

    new_narrated_btn.click(lambda: "Vídeo narrado", outputs=[nav])
    new_fashion_btn.click(lambda: "TikTok / Moda", outputs=[nav])
    refresh_home_btn.click(lambda: (render_metrics_html(), render_videos_html()),
                           outputs=[metrics_html, videos_html])
    refresh_queue_btn.click(lambda: render_queue_html(), outputs=[queue_html])
    refresh_lib_btn.click(lambda: render_videos_html(), outputs=[lib_html])

    # auto-refresh queue every 3s
    timer = gr.Timer(3.0)
    timer.tick(lambda: (render_queue_html(), render_metrics_html()),
               outputs=[queue_html, metrics_html])

    # Wizard navigation (steps & show_step already defined above)
    def build_summary(style, topic, fmt, provider, voice, scenes, burn, ref):
        style_label = next((l for l, v in STYLES if v == style), style)
        fmt_label = next((l for l, v in FORMATS if v == fmt), fmt)
        prov_label = next((l for l, v in IMAGE_PROVIDERS if v == provider), provider)
        ref_block = f"\n| **Referência YouTube** | `{ref}` |" if ref else ""
        return f"""
| | |
|---|---|
| **Estilo** | {style_label} |
| **Tema** | {topic} |
| **Formato** | {fmt_label} |
| **Imagens** | {prov_label} |
| **Voz** | `{voice}` |
| **Cenas** | {scenes} |
| **Legendas** | {'Sim' if burn else 'Não'} |{ref_block}
"""

    # All steps combined into single handlers (avoid .then() chaining issues)
    def step0_to_1(choice):
        return [choice, *show_step(1)]
    s0_next.click(
        step0_to_1, [s0_choice],
        [style_val, *steps, step_indicator, step_state],
    )
    s0_back.click(lambda: "Início", outputs=[nav])

    def step1_to_2(topic, ref):
        if not topic or not topic.strip():
            raise gr.Error("Informe um tema antes de continuar.")
        return [topic.strip(), ref.strip(), *show_step(2)]
    s1_next.click(
        step1_to_2, [s1_topic, s1_ref],
        [topic_val, reference_val, *steps, step_indicator, step_state],
    )
    s1_back.click(lambda: show_step(0), outputs=[*steps, step_indicator, step_state])

    def step2_to_3(fmt, prov):
        return [fmt, prov, *show_step(3)]
    s2_next.click(
        step2_to_3, [s2_format, s2_provider],
        [format_val, provider_val, *steps, step_indicator, step_state],
    )
    s2_back.click(lambda: show_step(1), outputs=[*steps, step_indicator, step_state])

    def step3_to_4(voice, scenes, burn, style, topic, fmt, provider, ref):
        summary = build_summary(style, topic, fmt, provider, voice, scenes, burn, ref)
        return [voice, scenes, burn, summary, *show_step(4)]
    s3_next.click(
        step3_to_4,
        [s3_voice, s3_scenes, s3_subs, style_val, topic_val, format_val, provider_val, reference_val],
        [voice_val, scenes_val, burnsubs_val, summary_md, *steps, step_indicator, step_state],
    )
    s3_back.click(lambda: show_step(2), outputs=[*steps, step_indicator, step_state])

    # step4 → submit
    def do_submit(style, topic, fmt, provider, voice, scenes, burn, ref):
        jid = submit_job(style, topic, fmt, provider, voice, scenes, burn, ref)
        msg = f"""
        <div style="background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(15,15,35,0.6));
                    border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:20px;margin-top:16px;">
          <div style="color:#22C55E;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Job #{jid:04d} enfileirado</div>
          <div style="color:#CBD5E1;">O worker assíncrono já começou a processar. Acompanhe pela aba <strong>Fila</strong> na barra lateral.</div>
        </div>
        """
        return gr.update(value=msg, visible=True), jid
    s4_submit.click(
        do_submit,
        [style_val, topic_val, format_val, provider_val, voice_val, scenes_val, burnsubs_val, reference_val],
        [success_html, created_job],
    ).then(lambda: (render_metrics_html(), render_queue_html()),
           outputs=[metrics_html, queue_html])
    s4_back.click(lambda: show_step(3), outputs=[*steps, step_indicator, step_state])

    # ============ FASHION WIZARD WIRING ============

    def f_step0_to_1(model_file):
        if not model_file:
            raise gr.Error("Suba uma foto da modelo antes de continuar.")
        path = model_file if isinstance(model_file, str) else model_file.name
        return [path, *show_fashion_step(1)]
    f_s0_next.click(
        f_step0_to_1, [f_model_file],
        [f_model_val, *f_steps, f_step_indicator, f_step_state],
    )
    f_s0_back.click(lambda: "Início", outputs=[nav])

    def f_step1_to_2(outfit_files):
        if not outfit_files:
            raise gr.Error("Suba ao menos uma foto da roupa.")
        if len(outfit_files) > 5:
            raise gr.Error("Máximo de 5 fotos de roupa por geração.")
        paths = [(f if isinstance(f, str) else f.name) for f in outfit_files]
        return [paths, *show_fashion_step(2)]
    f_s1_next.click(
        f_step1_to_2, [f_outfit_files],
        [f_outfits_val, *f_steps, f_step_indicator, f_step_state],
    )
    f_s1_back.click(lambda: show_fashion_step(0),
                    outputs=[*f_steps, f_step_indicator, f_step_state])

    # Preset chip → fills scene textbox
    for chip, (_, preset_text) in zip(f_preset_chips, FASHION_SCENE_PRESETS):
        chip.click(lambda txt=preset_text: txt, outputs=[f_scene_text])

    def build_fashion_summary(scene, shots, dur, title, model_p, outfit_ps, has_bgm):
        outfit_count = len(outfit_ps) if outfit_ps else 0
        return f"""
| | |
|---|---|
| **Modelo** | `{Path(model_p).name if model_p else '—'}` |
| **Roupas** | {outfit_count} foto(s) |
| **Cenário** | {scene[:120]}{'...' if len(scene) > 120 else ''} |
| **Imagens a gerar** | {shots} |
| **Duração por imagem** | {dur:.1f}s |
| **Duração total estimada** | {shots * dur:.1f}s |
| **Trilha sonora** | {'Sim' if has_bgm else 'Não'} |
| **Título** | {title or '— (auto)'} |
"""

    def f_step2_to_3(scene, shots, dur, title, bgm_file, model_p, outfit_ps):
        if not scene or not scene.strip():
            raise gr.Error("Descreva o cenário/contexto antes de continuar.")
        bgm_path = (bgm_file if isinstance(bgm_file, str) else bgm_file.name) if bgm_file else None
        summary = build_fashion_summary(scene.strip(), int(shots), float(dur), title, model_p, outfit_ps, bool(bgm_path))
        return [scene.strip(), int(shots), float(dur), bgm_path, title, summary, *show_fashion_step(3)]

    f_s2_next.click(
        f_step2_to_3,
        [f_scene_text, f_num_shots, f_shot_duration, f_title, f_bgm_file, f_model_val, f_outfits_val],
        [f_scene_val, f_shots_val, f_duration_val, f_bgm_val, f_title_val, f_summary, *f_steps, f_step_indicator, f_step_state],
    )
    f_s2_back.click(lambda: show_fashion_step(1),
                    outputs=[*f_steps, f_step_indicator, f_step_state])

    def do_fashion_submit(model_p, outfit_ps, scene, shots, dur, bgm, title):
        if not config.check_keys()["gemini"]:
            raise gr.Error("GEMINI_API_KEY não configurada no .env")
        params = {
            "video_type": "fashion",
            "model_image": model_p,
            "outfit_images": outfit_ps,
            "scene_idea": scene,
            "num_shots": int(shots),
            "shot_duration": float(dur),
            "bgm_path": bgm,
            "title": title or f"Fashion · {scene[:40]}",
        }
        jid = job_queue.enqueue(params)
        msg = f"""
        <div style="background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(15,15,35,0.6));
                    border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:20px;margin-top:16px;">
          <div style="color:#22C55E;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Job #{jid:04d} enfileirado</div>
          <div style="color:#CBD5E1;">Acompanhe pela aba <strong>Fila</strong> na barra lateral.</div>
        </div>
        """
        return gr.update(value=msg, visible=True)
    f_s3_submit.click(
        do_fashion_submit,
        [f_model_val, f_outfits_val, f_scene_val, f_shots_val, f_duration_val, f_bgm_val, f_title_val],
        [f_success_html],
    ).then(lambda: (render_metrics_html(), render_queue_html()),
           outputs=[metrics_html, queue_html])
    f_s3_back.click(lambda: show_fashion_step(2),
                    outputs=[*f_steps, f_step_indicator, f_step_state])


if __name__ == "__main__":
    demo.queue(max_size=20).launch(
        server_name="127.0.0.1",
        server_port=7860,
        inbrowser=True,
        allowed_paths=[str(config.OUTPUT_DIR), str(config.CACHE_DIR)],
    )

# Video Auto

Pipeline em Python que gera vídeos longos (16:9) de curiosidades narradas em PT-BR, do zero ao MP4 pronto, usando APIs gratuitas.

## Como funciona

```
Tema  →  Roteiro (Gemini)  →  Imagens (Pollinations.ai)  →  Narração (Edge-TTS)
                                                                   ↓
                                       Vídeo MP4  ←  MoviePy + Ken Burns
```

## O que é gratuito aqui

| Etapa | Serviço | Custo | Precisa chave? |
|---|---|---|---|
| Roteiro | Google Gemini (`gemini-2.0-flash-exp`) | Grátis (15 req/min) | Sim |
| Imagens | Pollinations.ai (FLUX) | Grátis ilimitado | Não |
| Narração | Microsoft Edge-TTS | Grátis ilimitado | Não |
| Legendas (opcional) | Groq Whisper | Grátis | Sim |
| Montagem | MoviePy + FFmpeg | Local, grátis | — |

## Pré-requisitos

- Python 3.10+
- FFmpeg instalado (`brew install ffmpeg` no macOS)
- Uma chave da API do Gemini (grátis)

## Instalação

```bash
cd /Users/nicolas-ginfo/video-auto
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Obtendo a chave do Gemini (grátis, 2 minutos)

1. Acesse https://aistudio.google.com/apikey
2. Faça login com sua conta Google
3. Clique em **Create API Key** → escolha qualquer projeto
4. Copie a chave

## Obtendo a chave do Groq (opcional, grátis)

1. Acesse https://console.groq.com/keys
2. Crie conta e gere uma API key

## Configuração

```bash
cp .env.example .env
# Edite .env e cole sua chave do Gemini em GEMINI_API_KEY
```

## Como rodar

```bash
source .venv/bin/activate
python app.py
```

A interface abre automaticamente em http://127.0.0.1:7860.

1. Digite um tema (ex: *"5 lugares mais misteriosos do Brasil"*)
2. Escolha quantas cenas (12 é um bom padrão)
3. Escolha a voz
4. Clique em **Gerar vídeo**

O vídeo final é salvo em `output/`.

## Estrutura

```
video-auto/
├── app.py                  # Interface Gradio
├── requirements.txt
├── .env.example
├── src/
│   ├── config.py           # Config + leitura do .env
│   ├── script_generator.py # Roteiro via Gemini
│   ├── image_generator.py  # Imagens via Pollinations
│   ├── tts.py              # Narração via Edge-TTS
│   ├── subtitles.py        # Legendas via Groq Whisper
│   ├── video_assembler.py  # Montagem com Ken Burns
│   └── pipeline.py         # Orquestrador
├── output/                 # Vídeos finais
├── cache/                  # Imagens + áudios intermediários
└── assets/                 # Trilhas sonoras (opcional)
```

## Próximos passos / upgrades

- **Trilha sonora:** coloque um MP3 em `assets/bgm.mp3` e passe `bgm_path` no `assemble()`.
- **Vídeos animados (não só imagens):** trocar Pollinations por Runway/Kling via API (pagas) ou Hugging Face video models.
- **Avatares falando:** integrar HeyGen ou D-ID (pagos, mas tem free trial).
- **Vertical (Shorts):** trocar `VIDEO_WIDTH=1080`, `VIDEO_HEIGHT=1920` em `src/config.py`.

## Limitações conhecidas

- Pollinations.ai pode ficar lento em horários de pico — o código já tem retry exponencial.
- Edge-TTS depende de servidores Microsoft; raras vezes pode falhar e basta tentar de novo.
- Gemini Free Tier: ~15 req/min — suficiente para uso pessoal.

# Tomada

Pipeline autônomo de geração de vídeos com IA, em Next.js + Firebase + Gemini, com **worker local** para renderização. Sucessor da versão Python (`saas-video-automatizado`).

## Como funciona

```
UI Next (Gradio-like)  →  Firestore (fila)  →  Worker Node local
                                                  ↓
                                       Gemini 2.5 Pro   (roteiro / análise)
                                       Gemini 3.1 Image (imagens / fashion multi-input)
                                       Gemini 2.5 TTS   (narração)
                                       Pollinations.ai  (fallback grátis de imagens)
                                       FFmpeg           (Ken Burns + concat + BGM)
                                                  ↓
                                  Firebase Storage      ←  MP4 final + thumbnail
                                                  ↓
                          UI Next (Biblioteca / Fila atualiza em real-time)
```

## Dois modos

- **Vídeo narrado** — tema textual → roteiro → imagens → narração → MP4 (16:9 ou 9:16).
- **TikTok / Moda** — foto da modelo + fotos da roupa + cenário → imagens fotorrealistas via Gemini Image multi-input → vídeo 9:16 com BGM opcional.

## Pré-requisitos

- Node.js **≥ 20**
- FFmpeg instalado no `PATH` (ou caminho em `FFMPEG_PATH`)
- Projeto Firebase com **Firestore** ativado (Spark/free plan)
- Arquivos ficam em `./output/` e `./uploads/` no disco local (sem storage remoto)

## Setup

```bash
cd tomada
npm install
cp .env.example .env.local
# (e) cp .env.example .env  — usado pelo worker
```

Preencha as variáveis em `.env.local` e `.env`:

1. **`GEMINI_API_KEY`** — pegue em https://aistudio.google.com/apikey
2. **`NEXT_PUBLIC_FIREBASE_*`** — Console Firebase → Project Settings → Web App
3. **Service Account** — Console Firebase → Project Settings → Service Accounts → "Generate new private key". Salve o JSON como `serviceAccountKey.json` na raiz do projeto **OU** preencha `FIREBASE_SERVICE_ACCOUNT_KEY` com o JSON em uma linha (escape `\n`).

Suba as regras e o índice do Firestore (uma vez):

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

> [!note]
> As regras vêm permissivas por padrão. Em produção restrinja por auth.

## Rodando

Em **dois terminais**:

```bash
# terminal 1 — UI
npm run dev

# terminal 2 — worker (renderiza vídeos)
npm run worker
```

Abra http://localhost:3000 e crie um job. O worker fica fazendo polling no Firestore e processa um job por vez.

## Estrutura

```
tomada/
├── src/
│   ├── app/                      # rotas Next App Router
│   │   ├── page.tsx              # dashboard
│   │   ├── criar/narrado/page.tsx
│   │   ├── criar/fashion/page.tsx
│   │   ├── fila/page.tsx
│   │   ├── biblioteca/page.tsx
│   │   └── actions/jobs.ts       # Server Actions (enqueue + upload)
│   ├── components/
│   │   ├── ui/                   # primitives (Button, Input, RadioCards, Slider, ...)
│   │   └── layout/               # Sidebar, PageHeader
│   └── lib/
│       ├── firebase/             # client + admin SDK
│       ├── gemini/               # client + modelos
│       ├── pipeline/             # script-generator, image-generator, tts,
│       │                         # fashion-generator, video-assembler, pipeline, youtube-reference
│       ├── storage/              # upload/download helpers
│       ├── types/                # types compartilhados (Job, JobParams, etc.)
│       └── utils/                # cn, paths, time, slug, sleep
├── worker/
│   └── index.ts                  # long-poller no Firestore, executa o pipeline
├── .env.example
├── firestore.rules
├── storage.rules
└── package.json
```

## Modelos do Gemini usados

| Função                                  | Modelo                                | Configurável via                |
| --------------------------------------- | ------------------------------------- | ------------------------------- |
| Roteiro, planejamento fashion, análise  | `gemini-2.5-pro`                      | `GEMINI_TEXT_MODEL`             |
| Imagens (narrado + fashion multi-input) | `gemini-3.1-flash-image-preview`      | `GEMINI_IMAGE_MODEL`            |
| Narração TTS                            | `gemini-2.5-pro-preview-tts`          | `GEMINI_TTS_MODEL`              |
| Voz padrão                              | `Kore` (Puck/Charon/Fenrir/Aoede)     | `GEMINI_TTS_VOICE`              |

Pollinations.ai (FLUX) está disponível como provedor alternativo e como **fallback automático** quando o Gemini Image falha 3x consecutivas em modo narrado. Não requer chave.

## Pipeline narrado em detalhes

1. **Referência YouTube (opcional, 0-15%)** — yt-dlp baixa, FFmpeg extrai frames + áudio, Gemini transcreve e analisa estilo.
2. **Roteiro (18-25%)** — Gemini 2.5 Pro com `response_mime_type=application/json` → `{title, scenes: [{narration, visual}]}`.
3. **Imagens (28-65%)** — uma chamada por cena, com cache SHA-256 em disco.
4. **Narração (68-82%)** — Gemini TTS retorna PCM 24kHz, envelopamos em WAV e convertemos para MP3 via FFmpeg.
5. **Montagem (85-100%)** — FFmpeg renderiza cada cena com Ken Burns (zoompan), legendas opcionais (drawtext), fade in/out, depois concat.

## Pipeline fashion em detalhes

1. **Materialização** — worker baixa modelo/roupas/BGM do Storage para `tmp/`.
2. **Preparação** — sharp redimensiona para ≤1280px, JPEG quality 88.
3. **Planejamento (8-10%)** — Gemini 2.5 Pro lista N variações de cena em inglês (mesmo cenário, ângulos diferentes).
4. **Geração (10-90%)** — Gemini 3.1 Image com **multi-input** (foto modelo + 1..5 roupas + texto) + sistema cíclico de 8 poses.
5. **Montagem (88-100%)** — concat 9:16 com cortes rápidos (fade 0.15s) + BGM em volume alto (0.85).

## Worker

- **Polling** no Firestore a cada `WORKER_POLL_INTERVAL_MS` (default 2s).
- **Transação atômica** para reivindicar o próximo job (evita corrida se ligar 2 workers).
- **Recovery** — jobs em `running` quando o worker reinicia voltam para `queued`.
- **Concorrência** — 1 job por vez. Para paralelizar, rode múltiplos `npm run worker` (cada um pega um job diferente).
- **Falhas** — gravam `error` com stack no documento.

## Cache local

- `cache/img_<provider>_<hash>.jpg` — imagens narradas (cacheadas por SHA-256 de `provider|prompt|seed`).
- `cache/job_<jobId>/audio_NNN.mp3` — áudios TTS de cada cena.
- `cache/fashion_<jobId>/shot_NNN.jpg` — shots do modo fashion.
- `cache/yt/<slug>/` — vídeo + frames + transcript de referência YouTube.
- `output/<ts>_<slug>.mp4` — MP4 final antes do upload.

O cache nunca expira automaticamente; limpe com `rm -rf cache/ output/` se necessário.

## Pontos de extensão

- Novos modos: branch em `lib/pipeline/pipeline.ts::runPipeline`.
- Novos providers de imagem: estender `lib/pipeline/image-generator.ts`.
- Novos providers de TTS: estender `lib/pipeline/tts.ts`.
- Concorrência: rode múltiplos workers, cada um vai pegar o próximo `queued` na transação.

## Diferenças vs versão Python

- **MoviePy → FFmpeg puro** (fluent-ffmpeg + spawn). Ken Burns implementado via filtro `zoompan`.
- **Edge-TTS → Gemini TTS** (PCM 24kHz → WAV → MP3).
- **SQLite → Firestore** com snapshot listeners (UI atualiza em tempo real, sem polling).
- **Storage local** em `./output/<jobId>/video.mp4` e `./uploads/<kind>/...`, servido via rota `/api/files` com suporte a Range requests (player com seek).
- **faster-whisper → Gemini multimodal** para transcrição da referência YouTube.
- **Gradio → Next.js App Router + shadcn-style UI**.

## Comandos

| Comando            | Faz                              |
| ------------------ | -------------------------------- |
| `npm run dev`      | Next dev server em :3000         |
| `npm run worker`   | Worker local que processa a fila |
| `npm run build`    | Build de produção                |
| `npm run start`    | Servidor de produção             |
| `npm run lint`     | ESLint                           |

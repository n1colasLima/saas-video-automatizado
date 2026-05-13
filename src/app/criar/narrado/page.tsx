"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RadioCards } from "@/components/ui/radio-cards";
import { Stepper } from "@/components/ui/stepper";
import { PageHeader } from "@/components/layout/page-header";
import { enqueueNarrated } from "@/app/actions/jobs";
import type {
  ImageProvider,
  NarratedStyle,
  VideoFormat,
} from "@/lib/types/jobs";

const STEPS = ["Estilo", "Tema", "Formato", "Voz", "Confirmar"];

const STYLES: { value: NarratedStyle; label: string; description: string }[] = [
  { value: "curiosidades", label: "Curiosidades", description: "Revelações progressivas, engajamento" },
  { value: "misterios", label: "Mistérios", description: "Tom misterioso, perguntas instigantes" },
  { value: "historia", label: "História", description: "Documentário, datas e personagens" },
  { value: "ciencia", label: "Ciência", description: "Didático, analogias do dia a dia" },
  { value: "tops", label: "Tops / Listas", description: "Ranking, contagem progressiva" },
];

const FORMATS: { value: VideoFormat; label: string; description: string }[] = [
  { value: "16:9", label: "Horizontal · 16:9", description: "YouTube tradicional, 1920×1080" },
  { value: "9:16", label: "Vertical · 9:16", description: "Shorts / Reels / TikTok, 1080×1920" },
];

const PROVIDERS: { value: ImageProvider; label: string; description: string }[] = [
  { value: "gemini", label: "Gemini Image · Premium", description: "Cinematográfico, pago" },
  { value: "pollinations", label: "Pollinations · Grátis", description: "FLUX, sem chave" },
];

const VOICES = [
  { value: "Kore", label: "Kore (Gemini, padrão)" },
  { value: "Puck", label: "Puck (Gemini)" },
  { value: "Charon", label: "Charon (Gemini)" },
  { value: "Fenrir", label: "Fenrir (Gemini)" },
  { value: "Aoede", label: "Aoede (Gemini)" },
];

export default function NarradoWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [style, setStyle] = useState<NarratedStyle>("curiosidades");
  const [topic, setTopic] = useState("");
  const [reference, setReference] = useState("");
  const [videoFormat, setVideoFormat] = useState<VideoFormat>("16:9");
  const [provider, setProvider] = useState<ImageProvider>("gemini");
  const [voice, setVoice] = useState("Kore");
  const [numScenes, setNumScenes] = useState(12);
  const [burnSubs, setBurnSubs] = useState(true);

  function next() {
    setError(null);
    if (step === 1 && !topic.trim()) {
      setError("Informe um tema antes de continuar.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const id = await enqueueNarrated({
          videoType: "narrated",
          topic: topic.trim(),
          numScenes,
          style,
          videoFormat,
          imageProvider: provider,
          voice,
          burnSubtitles: burnSubs,
          referenceUrl: reference.trim() || undefined,
        });
        setSuccess(`Job #${id.slice(0, 6)} enfileirado. Acompanhe na aba Fila.`);
        setTimeout(() => router.push("/fila"), 1500);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="NOVO VÍDEO"
        title="Configurar geração."
        subtitle="Cinco passos rápidos. Depois de enfileirar, o worker processa em segundo plano."
      />
      <Stepper steps={STEPS} current={step} />

      {step === 0 ? (
        <div className="va-card">
          <div className="va-card-title">Escolha o estilo do conteúdo</div>
          <RadioCards value={style} onValueChange={setStyle} options={STYLES} columns={3} />
        </div>
      ) : null}

      {step === 1 ? (
        <>
          <div className="va-card">
            <div className="va-card-title">Tema do vídeo</div>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex.: 7 mistérios não resolvidos da Amazônia brasileira"
              rows={3}
            />
          </div>
          <div className="va-card mt-4">
            <div className="va-card-title">Referência (opcional)</div>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <p className="mt-2 text-xs text-ink-deep">
              O sistema baixa, transcreve e analisa o estilo visual + narrativo para inspirar
              (não copia).
            </p>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="va-card">
            <div className="va-card-title">Formato do vídeo</div>
            <RadioCards
              value={videoFormat}
              onValueChange={setVideoFormat}
              options={FORMATS}
            />
          </div>
          <div className="va-card mt-4">
            <div className="va-card-title">Gerador de imagens</div>
            <RadioCards value={provider} onValueChange={setProvider} options={PROVIDERS} />
            <p className="mt-2 text-xs text-ink-deep">
              Gemini Image entrega qualidade cinematográfica (pago). Pollinations é grátis.
            </p>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <div className="va-card">
          <div className="va-card-title">Narração e duração</div>
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Voz da narração
              </label>
              <Select value={voice} onValueChange={setVoice} options={VOICES} />
              <p className="mt-1 text-xs text-ink-deep">
                Gemini TTS (modelo 2.5-pro-preview-tts)
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-ink-muted">
                  Número de cenas
                </span>
                <span className="font-mono text-accent-soft">{numScenes}</span>
              </div>
              <Slider value={numScenes} onValueChange={setNumScenes} min={6} max={20} />
              <p className="mt-1 text-xs text-ink-deep">
                Cada cena: 1 imagem + narração de 1 a 3 frases.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-ink">Queimar legendas no vídeo</div>
                <div className="text-xs text-ink-deep">Sobrepõe texto da narração</div>
              </div>
              <Switch checked={burnSubs} onCheckedChange={setBurnSubs} />
            </div>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="va-card">
          <div className="va-card-title">Revisar e enviar</div>
          <table className="w-full text-sm">
            <tbody className="[&>tr]:border-b [&>tr]:border-white/5 [&>tr:last-child]:border-0 [&>tr>td]:py-2.5">
              <tr>
                <td className="font-medium text-ink-muted">Estilo</td>
                <td className="text-right">{STYLES.find((s) => s.value === style)?.label}</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Tema</td>
                <td className="text-right">{topic}</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Formato</td>
                <td className="text-right">{FORMATS.find((f) => f.value === videoFormat)?.label}</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Imagens</td>
                <td className="text-right">{PROVIDERS.find((p) => p.value === provider)?.label}</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Voz</td>
                <td className="font-mono text-right text-accent-soft">{voice}</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Cenas</td>
                <td className="text-right">{numScenes}</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Legendas</td>
                <td className="text-right">{burnSubs ? "Sim" : "Não"}</td>
              </tr>
              {reference ? (
                <tr>
                  <td className="font-medium text-ink-muted">Referência</td>
                  <td className="truncate text-right font-mono text-xs">{reference}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="mt-6 flex gap-3">
        {step === 0 ? (
          <Button variant="secondary" onClick={() => router.push("/")}>
            Cancelar
          </Button>
        ) : (
          <Button variant="secondary" onClick={back}>
            ← Voltar
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Continuar →</Button>
        ) : (
          <Button onClick={submit} disabled={pending}>
            {pending ? "Enviando..." : "Enviar para a fila"}
          </Button>
        )}
      </div>
    </>
  );
}

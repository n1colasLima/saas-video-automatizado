"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { Card, CardTitle, CardHint } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RadioCards } from "@/components/ui/RadioCards";
import { Input, Textarea, Label } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Switch } from "@/components/ui/Switch";
import { enqueueNarratedJob } from "@/app/actions/jobs";
import type {
  ImageProvider,
  NarratedStyle,
  VideoFormat,
} from "@/lib/types/jobs";

const STEP_NAMES = ["Estilo", "Tema", "Formato", "Voz", "Confirmar"];

const STYLES: { value: NarratedStyle; label: string; description: string }[] = [
  { value: "curiosidades", label: "Curiosidades", description: "Fatos surpreendentes em ritmo solto" },
  { value: "misterios", label: "Mistérios", description: "Enigmas, lendas e inexplicáveis" },
  { value: "historia", label: "História", description: "Eventos e personagens reais" },
  { value: "ciencia", label: "Ciência", description: "Explicações divulgativas" },
  { value: "tops", label: "Tops / Listas", description: "Top 5, 10, etc." },
];

const FORMATS: { value: VideoFormat; label: string; description: string }[] = [
  { value: "16:9", label: "Horizontal · YouTube", description: "1920×1080, 30fps" },
  { value: "9:16", label: "Vertical · Shorts/Reels", description: "1080×1920, 30fps" },
];

const PROVIDERS: { value: ImageProvider; label: string; description: string }[] = [
  { value: "gemini", label: "Gemini Image · Premium", description: "Qualidade cinematográfica (pago)" },
  { value: "pollinations", label: "Pollinations · Grátis", description: "FLUX, sem custo" },
];

const VOICES = ["Kore", "Puck", "Charon", "Fenrir", "Aoede"] as const;

export default function NarradoPage() {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [style, setStyle] = useState<NarratedStyle>("curiosidades");
  const [topic, setTopic] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [videoFormat, setVideoFormat] = useState<VideoFormat>("16:9");
  const [imageProvider, setImageProvider] = useState<ImageProvider>("pollinations");
  const [voice, setVoice] = useState("Kore");
  const [numScenes, setNumScenes] = useState(12);
  const [burnSubtitles, setBurnSubtitles] = useState(true);

  function goPrev() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }
  function goNext() {
    setError(null);
    if (step === 1 && !topic.trim()) {
      setError("Informe um tema antes de continuar.");
      return;
    }
    setStep((s) => Math.min(STEP_NAMES.length - 1, s + 1));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await enqueueNarratedJob({
          videoType: "narrated",
          topic: topic.trim(),
          style,
          videoFormat,
          imageProvider,
          voice,
          numScenes,
          burnSubtitles,
          referenceUrl: referenceUrl.trim() || undefined,
        });
        setCreatedId(id);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Novo vídeo"
        title="Configurar geração."
        subtitle="Cinco passos rápidos. Depois de enfileirar, o worker processa em segundo plano enquanto você programa o próximo."
      />

      <Stepper steps={STEP_NAMES} active={step} />

      {createdId ? (
        <SuccessCard jobId={createdId} />
      ) : (
        <div className="space-y-4">
          {step === 0 && (
            <Card>
              <CardTitle>Escolha o estilo do conteúdo</CardTitle>
              <RadioCards value={style} onValueChange={setStyle} options={STYLES} />
            </Card>
          )}

          {step === 1 && (
            <>
              <Card>
                <CardTitle>Tema do vídeo</CardTitle>
                <Label htmlFor="topic">Sobre o que será o vídeo?</Label>
                <Textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex.: 7 mistérios não resolvidos da Amazônia brasileira"
                  rows={3}
                />
              </Card>
              <Card>
                <CardTitle>Referência (opcional)</CardTitle>
                <Label
                  htmlFor="ref"
                  hint="O sistema baixa, transcreve e analisa o estilo visual + narrativo para inspirar o novo vídeo (não copia)."
                >
                  URL de vídeo do YouTube como inspiração
                </Label>
                <Input
                  id="ref"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </Card>
            </>
          )}

          {step === 2 && (
            <>
              <Card>
                <CardTitle>Formato do vídeo</CardTitle>
                <RadioCards
                  value={videoFormat}
                  onValueChange={setVideoFormat}
                  options={FORMATS}
                />
              </Card>
              <Card>
                <CardTitle>Gerador de imagens</CardTitle>
                <RadioCards
                  value={imageProvider}
                  onValueChange={setImageProvider}
                  options={PROVIDERS}
                />
                <CardHint>
                  Gemini Image entrega qualidade cinematográfica (pago). Pollinations é
                  grátis.
                </CardHint>
              </Card>
            </>
          )}

          {step === 3 && (
            <Card>
              <CardTitle>Narração e duração</CardTitle>
              <div className="space-y-5">
                <div>
                  <Label hint="Vozes neurais Gemini 2.5 Flash — gratuito">
                    Voz da narração
                  </Label>
                  <Select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                  >
                    {VOICES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label hint="Cada cena vira uma imagem + narração de 1–3 frases">
                    Número de cenas:{" "}
                    <span className="font-mono text-accent-soft">{numScenes}</span>
                  </Label>
                  <Slider
                    value={numScenes}
                    onValueChange={setNumScenes}
                    min={6}
                    max={20}
                    step={1}
                  />
                </div>
                <div>
                  <Switch
                    checked={burnSubtitles}
                    onCheckedChange={setBurnSubtitles}
                    label="Queimar legendas no vídeo"
                  />
                </div>
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardTitle>Revisar e enviar para fila</CardTitle>
              <SummaryTable
                rows={[
                  ["Estilo", STYLES.find((s) => s.value === style)?.label ?? style],
                  ["Tema", topic || "—"],
                  [
                    "Formato",
                    FORMATS.find((f) => f.value === videoFormat)?.label ?? videoFormat,
                  ],
                  [
                    "Imagens",
                    PROVIDERS.find((p) => p.value === imageProvider)?.label ??
                      imageProvider,
                  ],
                  ["Voz", voice],
                  ["Cenas", String(numScenes)],
                  ["Legendas", burnSubtitles ? "Sim" : "Não"],
                  ...(referenceUrl
                    ? ([["Referência", referenceUrl]] as [string, string][])
                    : []),
                ]}
              />
            </Card>
          )}

          {error && (
            <div className="rounded-[12px] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {step === 0 ? (
              <Link href="/">
                <Button variant="secondary">Cancelar</Button>
              </Link>
            ) : (
              <Button variant="secondary" onClick={goPrev} disabled={pending}>
                ← Voltar
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={goNext}>Continuar →</Button>
            ) : (
              <Button onClick={submit} disabled={pending}>
                {pending ? "Enviando..." : "Enviar para a fila"}
              </Button>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}

function SummaryTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-white/[0.06]">
      {rows.map(([k, v], i) => (
        <div
          key={k}
          className={`grid grid-cols-[160px_1fr] gap-4 px-4 py-3 text-sm ${
            i % 2 === 0 ? "bg-white/[0.02]" : ""
          }`}
        >
          <div className="font-semibold text-ink-muted">{k}</div>
          <div className="text-ink">{v}</div>
        </div>
      ))}
    </div>
  );
}

function SuccessCard({ jobId }: { jobId: string }) {
  return (
    <div className="rounded-[12px] border border-emerald-500/30 bg-[linear-gradient(135deg,rgba(34,197,94,0.15),rgba(15,15,35,0.6))] p-6">
      <div className="font-mono text-[12px] font-bold uppercase tracking-[0.15em] text-emerald-400">
        Job #{jobId.slice(-6)} enfileirado
      </div>
      <p className="mt-2 text-ink-soft">
        O worker assíncrono já começou a processar. Acompanhe pela aba{" "}
        <Link href="/fila" className="font-semibold text-accent-soft underline">
          Fila
        </Link>{" "}
        na barra lateral.
      </p>
      <div className="mt-4 flex gap-3">
        <Link href="/fila">
          <Button>Ir para a fila</Button>
        </Link>
        <Link href="/criar/narrado">
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            Criar outro
          </Button>
        </Link>
      </div>
    </div>
  );
}

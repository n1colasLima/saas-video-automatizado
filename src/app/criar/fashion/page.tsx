"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Field";
import { Slider } from "@/components/ui/Slider";
import { FileDrop } from "@/components/ui/FileDrop";
import { enqueueFashionFromForm } from "@/app/actions/jobs";

const STEPS = ["Modelo", "Roupa", "Cenário", "Confirmar"];

const SCENE_PRESETS: { label: string; prompt: string }[] = [
  {
    label: "Closet",
    prompt:
      "luxurious walk-in closet with soft warm lighting, mirrors, hanging clothes in the background, polished wooden floor, vertical 9:16 framing",
  },
  {
    label: "Academia",
    prompt:
      "modern gym interior, rubber flooring, weight racks and machines softly out of focus in the background, dramatic sidelight, vertical 9:16 framing",
  },
  {
    label: "Quarto",
    prompt:
      "modern bedroom with neutral tones, large window with soft natural daylight, minimalist bed, vertical 9:16 framing",
  },
  {
    label: "Rua urbana",
    prompt:
      "trendy urban street, soft golden hour sunlight, blurred passersby and city buildings in the background, vertical 9:16 framing",
  },
  {
    label: "Café",
    prompt:
      "stylish modern coffee shop interior, warm pendant lights, blurred patrons in background, big windows, vertical 9:16 framing",
  },
  {
    label: "Praia",
    prompt:
      "beach at golden hour, soft sand, gentle waves in the background, warm sunlight, vertical 9:16 framing",
  },
  {
    label: "Estúdio neutro",
    prompt:
      "professional fashion photography studio, seamless neutral gray backdrop, soft umbrella lighting, vertical 9:16 framing",
  },
  {
    label: "Rooftop",
    prompt:
      "rooftop terrace with city skyline at sunset behind, warm bokeh lights, vertical 9:16 framing",
  },
];

export default function FashionPage() {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [modelFiles, setModelFiles] = useState<File[]>([]);
  const [outfitFiles, setOutfitFiles] = useState<File[]>([]);
  const [bgmFiles, setBgmFiles] = useState<File[]>([]);
  const [scene, setScene] = useState("");
  const [numShots, setNumShots] = useState(6);
  const [shotDuration, setShotDuration] = useState(2.2);
  const [title, setTitle] = useState("");

  function goPrev() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }
  function goNext() {
    setError(null);
    if (step === 0 && !modelFiles[0]) {
      setError("Suba uma foto da modelo antes de continuar.");
      return;
    }
    if (step === 1 && outfitFiles.length === 0) {
      setError("Suba ao menos uma foto da roupa.");
      return;
    }
    if (step === 2 && !scene.trim()) {
      setError("Descreva o cenário antes de continuar.");
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const form = new FormData();
        form.append("modelFile", modelFiles[0]!);
        for (const f of outfitFiles.slice(0, 5)) form.append("outfitFiles", f);
        if (bgmFiles[0]) form.append("bgmFile", bgmFiles[0]);
        form.append("sceneIdea", scene.trim());
        form.append("numShots", String(numShots));
        form.append("shotDuration", String(shotDuration));
        form.append("title", title.trim());
        const { id } = await enqueueFashionFromForm(form);
        setCreatedId(id);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="TikTok Shop · Moda"
        title="Modelo + roupa + cenário."
        subtitle="Suba uma foto da modelo e das roupas. A IA gera múltiplas imagens dela vestindo a roupa em poses naturais e monta em um vídeo vertical 9:16."
      />

      <Stepper steps={STEPS} active={step} />

      {createdId ? (
        <SuccessCard jobId={createdId} />
      ) : (
        <div className="space-y-4">
          {step === 0 && (
            <Card>
              <CardTitle>Foto da modelo</CardTitle>
              <p className="mb-4 text-sm text-ink-muted">
                Suba uma foto <strong>bem iluminada, de corpo inteiro de preferência</strong>,
                mostrando o rosto e o tipo físico da modelo. Essa será a referência de
                identidade em todas as imagens geradas.
              </p>
              <FileDrop
                files={modelFiles}
                onChange={setModelFiles}
                accept="image/*"
                label="Arraste a foto da modelo (JPG/PNG)"
              />
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardTitle>Foto(s) da roupa</CardTitle>
              <p className="mb-4 text-sm text-ink-muted">
                Suba uma ou mais fotos da peça que a modelo deve vestir (frente, costas,
                detalhes). Quanto mais clara a roupa nas fotos, melhor o resultado.
              </p>
              <FileDrop
                files={outfitFiles}
                onChange={setOutfitFiles}
                multiple
                maxFiles={5}
                accept="image/*"
                label="Arraste até 5 fotos da roupa"
              />
            </Card>
          )}

          {step === 2 && (
            <>
              <Card>
                <CardTitle>Cenário e estilo</CardTitle>
                <Label htmlFor="scene">Descrição do cenário</Label>
                <Textarea
                  id="scene"
                  value={scene}
                  onChange={(e) => setScene(e.target.value)}
                  rows={4}
                  placeholder="Ex.: modelo em uma academia moderna, vestindo a calça legging, mostrando o ajuste no quadril, iluminação dramática"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {SCENE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setScene(p.prompt)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-ink-soft transition-all duration-200 hover:border-accent/40 hover:bg-accent/10 hover:text-accent-soft"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <CardTitle>Parâmetros do vídeo</CardTitle>
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="title">Título do vídeo (opcional)</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex.: Legging preta — coleção verão"
                    />
                  </div>
                  <div>
                    <Label
                      hint={`Cada imagem ~$0.04 no Gemini. ${numShots} imagens × ${shotDuration.toFixed(
                        1,
                      )}s = vídeo de ~${(numShots * shotDuration).toFixed(0)}s`}
                    >
                      Número de imagens:{" "}
                      <span className="font-mono text-accent-soft">{numShots}</span>
                    </Label>
                    <Slider
                      value={numShots}
                      onValueChange={setNumShots}
                      min={4}
                      max={12}
                      step={1}
                    />
                  </div>
                  <div>
                    <Label hint="TikTok funciona bem com cortes rápidos de 1.5–2.5s">
                      Duração por imagem:{" "}
                      <span className="font-mono text-accent-soft">
                        {shotDuration.toFixed(1)}s
                      </span>
                    </Label>
                    <Slider
                      value={Math.round(shotDuration * 10)}
                      onValueChange={(v) => setShotDuration(v / 10)}
                      min={10}
                      max={40}
                      step={1}
                    />
                  </div>
                  <div>
                    <Label>Trilha sonora (MP3 opcional)</Label>
                    <FileDrop
                      files={bgmFiles}
                      onChange={setBgmFiles}
                      accept="audio/*"
                      variant="audio"
                    />
                  </div>
                </div>
              </Card>
            </>
          )}

          {step === 3 && (
            <Card>
              <CardTitle>Revisar e enviar para fila</CardTitle>
              <SummaryTable
                rows={[
                  ["Modelo", modelFiles[0]?.name ?? "—"],
                  ["Roupas", `${outfitFiles.length} foto(s)`],
                  [
                    "Cenário",
                    scene.length > 120 ? scene.slice(0, 120) + "..." : scene,
                  ],
                  ["Imagens a gerar", String(numShots)],
                  ["Duração por imagem", `${shotDuration.toFixed(1)}s`],
                  [
                    "Duração total estimada",
                    `${(numShots * shotDuration).toFixed(1)}s`,
                  ],
                  ["Trilha sonora", bgmFiles[0] ? bgmFiles[0].name : "Não"],
                  ["Título", title || "— (auto)"],
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
            {step < 3 ? (
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
          className={`grid grid-cols-[180px_1fr] gap-4 px-4 py-3 text-sm ${
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
        Acompanhe pela aba{" "}
        <Link href="/fila" className="font-semibold text-accent-soft underline">
          Fila
        </Link>
        .
      </p>
      <div className="mt-4 flex gap-3">
        <Link href="/fila">
          <Button>Ir para a fila</Button>
        </Link>
        <Link href="/criar/fashion">
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Stepper } from "@/components/ui/stepper";
import { PageHeader } from "@/components/layout/page-header";
import { enqueueFashion, uploadFashionAsset } from "@/app/actions/jobs";

const STEPS = ["Modelo", "Roupa", "Cenário", "Confirmar"];

const PRESETS: { label: string; text: string }[] = [
  { label: "Closet", text: "luxurious walk-in closet with soft warm lighting, mirrors, hanging clothes in the background, polished wooden floor, vertical 9:16 framing" },
  { label: "Academia", text: "modern gym interior, rubber flooring, weight racks and machines softly out of focus in the background, dramatic sidelight, vertical 9:16 framing" },
  { label: "Quarto", text: "modern bedroom with neutral tones, large window with soft natural daylight, minimalist bed, vertical 9:16 framing" },
  { label: "Rua urbana", text: "trendy urban street, soft golden hour sunlight, blurred passersby and city buildings in the background, vertical 9:16 framing" },
  { label: "Café", text: "stylish modern coffee shop interior, warm pendant lights, blurred patrons in background, big windows, vertical 9:16 framing" },
  { label: "Praia", text: "beach at golden hour, soft sand, gentle waves in the background, warm sunlight, vertical 9:16 framing" },
  { label: "Estúdio neutro", text: "professional fashion photography studio, seamless neutral gray backdrop, soft umbrella lighting, vertical 9:16 framing" },
  { label: "Rooftop", text: "rooftop terrace with city skyline at sunset behind, warm bokeh lights, vertical 9:16 framing" },
];

export default function FashionWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modelPath, setModelPath] = useState<string | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const [outfitPaths, setOutfitPaths] = useState<{ name: string; path: string }[]>([]);
  const [scene, setScene] = useState("");
  const [title, setTitle] = useState("");
  const [numShots, setNumShots] = useState(6);
  const [shotDuration, setShotDuration] = useState(2.2);
  const [bgmPath, setBgmPath] = useState<string | null>(null);
  const [bgmName, setBgmName] = useState<string | null>(null);

  async function uploadAsset(file: File, kind: "model" | "outfit" | "bgm") {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    return uploadFashionAsset(fd);
  }

  async function onModelChange(file: File | null) {
    if (!file) return;
    setError(null);
    try {
      const { storagePath } = await uploadAsset(file, "model");
      setModelPath(storagePath);
      setModelName(file.name);
    } catch (err) {
      setError(`Falha no upload da modelo: ${(err as Error).message}`);
    }
  }

  async function onOutfitChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files).slice(0, 5);
    try {
      const uploaded = await Promise.all(
        list.map(async (f) => {
          const { storagePath } = await uploadAsset(f, "outfit");
          return { name: f.name, path: storagePath };
        }),
      );
      setOutfitPaths(uploaded);
    } catch (err) {
      setError(`Falha no upload das roupas: ${(err as Error).message}`);
    }
  }

  async function onBgmChange(file: File | null) {
    if (!file) return;
    try {
      const { storagePath } = await uploadAsset(file, "bgm");
      setBgmPath(storagePath);
      setBgmName(file.name);
    } catch (err) {
      setError(`Falha no upload da trilha: ${(err as Error).message}`);
    }
  }

  function next() {
    setError(null);
    if (step === 0 && !modelPath) {
      setError("Suba uma foto da modelo antes de continuar.");
      return;
    }
    if (step === 1 && outfitPaths.length === 0) {
      setError("Suba ao menos uma foto da roupa.");
      return;
    }
    if (step === 2 && !scene.trim()) {
      setError("Descreva o cenário antes de continuar.");
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
        const id = await enqueueFashion({
          videoType: "fashion",
          modelImagePath: modelPath!,
          outfitImagePaths: outfitPaths.map((o) => o.path),
          sceneIdea: scene.trim(),
          numShots,
          shotDuration,
          bgmPath: bgmPath ?? undefined,
          title: title.trim() || `Fashion · ${scene.slice(0, 40)}`,
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
        eyebrow="TIKTOK SHOP · MODA"
        title="Modelo + roupa + cenário."
        subtitle="Suba uma foto da modelo e das roupas. A IA gera múltiplas imagens dela vestindo a peça em poses naturais e monta em um vídeo vertical 9:16."
      />
      <Stepper steps={STEPS} current={step} />

      {step === 0 ? (
        <div className="va-card">
          <div className="va-card-title">Foto da modelo</div>
          <p className="mb-4 text-sm text-ink-muted">
            Suba uma foto <strong>bem iluminada, de corpo inteiro de preferência</strong>,
            mostrando o rosto e o tipo físico. Essa é a referência de identidade.
          </p>
          <input
            type="file"
            accept="image/*"
            className="block w-full cursor-pointer rounded-md border-2 border-dashed border-white/10 bg-[rgba(15,15,35,0.6)] p-6 text-sm text-ink-muted file:mr-4 file:cursor-pointer file:rounded file:border-0 file:bg-accent/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent-soft hover:border-accent/40"
            onChange={(e) => onModelChange(e.target.files?.[0] ?? null)}
          />
          {modelName ? (
            <div className="mt-3 text-xs text-emerald-400">✓ {modelName} enviado</div>
          ) : null}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="va-card">
          <div className="va-card-title">Foto(s) da roupa</div>
          <p className="mb-4 text-sm text-ink-muted">
            Uma ou mais fotos da peça (frente, costas, detalhes). Máximo 5 fotos. Quanto
            mais clara a roupa, melhor o resultado.
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            className="block w-full cursor-pointer rounded-md border-2 border-dashed border-white/10 bg-[rgba(15,15,35,0.6)] p-6 text-sm text-ink-muted file:mr-4 file:cursor-pointer file:rounded file:border-0 file:bg-accent/20 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent-soft hover:border-accent/40"
            onChange={(e) => onOutfitChange(e.target.files)}
          />
          {outfitPaths.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-emerald-400">
              {outfitPaths.map((o) => (
                <li key={o.path}>✓ {o.name}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <>
          <div className="va-card">
            <div className="va-card-title">Cenário e estilo</div>
            <Textarea
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              placeholder="Ex.: modelo em uma academia moderna, vestindo a calça legging, mostrando o ajuste no quadril, iluminação dramática"
              rows={4}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setScene(p.text)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:border-accent/40 hover:bg-accent/15 hover:text-accent-soft"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="va-card mt-4">
            <div className="va-card-title">Parâmetros do vídeo</div>
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Título do vídeo (opcional)
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Legging preta · coleção verão"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-ink-muted">
                    Número de imagens
                  </span>
                  <span className="font-mono text-accent-soft">{numShots}</span>
                </div>
                <Slider value={numShots} onValueChange={setNumShots} min={4} max={12} />
                <p className="mt-1 text-xs text-ink-deep">
                  Cada imagem ≈ $0.04 no Gemini. {numShots} imagens × {shotDuration.toFixed(1)}s
                  ≈ {(numShots * shotDuration).toFixed(0)}s de vídeo.
                </p>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold uppercase tracking-wider text-ink-muted">
                    Duração por imagem (s)
                  </span>
                  <span className="font-mono text-accent-soft">{shotDuration.toFixed(1)}</span>
                </div>
                <Slider
                  value={shotDuration * 10}
                  onValueChange={(v) => setShotDuration(v / 10)}
                  min={10}
                  max={40}
                />
                <p className="mt-1 text-xs text-ink-deep">
                  TikTok funciona bem com cortes rápidos de 1.5 a 2.5s.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Trilha sonora (MP3 opcional)
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  className="block w-full cursor-pointer rounded-md border-2 border-dashed border-white/10 bg-[rgba(15,15,35,0.6)] p-4 text-sm text-ink-muted file:mr-4 file:cursor-pointer file:rounded file:border-0 file:bg-accent/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent-soft hover:border-accent/40"
                  onChange={(e) => onBgmChange(e.target.files?.[0] ?? null)}
                />
                {bgmName ? (
                  <div className="mt-2 text-xs text-emerald-400">✓ {bgmName} enviado</div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <div className="va-card">
          <div className="va-card-title">Revisar e enviar</div>
          <table className="w-full text-sm">
            <tbody className="[&>tr]:border-b [&>tr]:border-white/5 [&>tr:last-child]:border-0 [&>tr>td]:py-2.5">
              <tr>
                <td className="font-medium text-ink-muted">Modelo</td>
                <td className="text-right">{modelName}</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Roupas</td>
                <td className="text-right">{outfitPaths.length} foto(s)</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Cenário</td>
                <td className="text-right">{scene.slice(0, 90)}{scene.length > 90 ? "..." : ""}</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Imagens a gerar</td>
                <td className="text-right">{numShots}</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Duração total</td>
                <td className="text-right">{(numShots * shotDuration).toFixed(1)}s</td>
              </tr>
              <tr>
                <td className="font-medium text-ink-muted">Trilha sonora</td>
                <td className="text-right">{bgmName ?? "Não"}</td>
              </tr>
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

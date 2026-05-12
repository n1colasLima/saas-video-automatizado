"use client";

import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Empty } from "@/components/ui/Empty";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/Progress";
import { useJobs } from "@/lib/firebase/jobs-client";
import { formatRelative } from "@/lib/utils/time";

export default function FilaPage() {
  const { jobs, loading } = useJobs(50);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Fila"
        title="Geração em andamento."
        subtitle="Acompanhe em tempo real o progresso dos vídeos em produção. A lista atualiza via snapshot listener do Firestore — sem polling."
      />

      {loading ? (
        <Empty title="Carregando..." />
      ) : jobs.length === 0 ? (
        <Empty title="A fila está vazia">
          Crie um vídeo narrado ou fashion para começar a popular esta lista.
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {jobs.map((j) => {
            const params = j.params;
            const fallbackTitle =
              j.title ||
              (params.videoType === "narrated"
                ? params.topic
                : params.title || params.sceneIdea);
            return (
              <li
                key={j.id}
                className="grid items-center gap-4 rounded-[12px] border border-white/[0.08] bg-[rgba(15,15,35,0.5)] px-4 py-3.5 [grid-template-columns:auto_1fr_120px_auto_auto]"
              >
                <div className="font-mono text-[12px] text-ink-deep">
                  #{j.id.slice(-6)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">
                    {fallbackTitle || "Sem título"}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-dim">
                    {j.progressMsg || "—"}
                  </div>
                </div>
                <ProgressBar value={j.progress} />
                <div className="font-mono text-xs text-ink-muted">
                  {formatRelative(j.updatedAt)}
                </div>
                <StatusBadge status={j.status} />
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { subscribeJobs } from "@/lib/firebase/jobs";
import type { Job } from "@/lib/types/jobs";

const statusStyle: Record<Job["status"], string> = {
  queued: "bg-white/10 text-ink-muted",
  running: "bg-amber-500/15 text-amber-400",
  done: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
};

export default function FilaPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => subscribeJobs(setJobs, { limit: 30 }), []);

  return (
    <>
      <PageHeader
        eyebrow="FILA"
        title="Geração em andamento."
        subtitle="Acompanhe em tempo real o progresso dos vídeos em produção. Atualiza automaticamente via Firestore."
      />

      {jobs.length === 0 ? (
        <div className="rounded-md border border-dashed border-white/10 px-6 py-14 text-center text-ink-deep">
          <div className="text-[15px] font-semibold text-ink-muted">A fila está vazia</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {jobs.map((j) => {
            const params = j.params;
            const title =
              j.title ??
              (params.videoType === "narrated" ? params.topic : params.title) ??
              "Sem título";
            return (
              <div
                key={j.id}
                className="grid grid-cols-[auto_1fr_120px_auto] items-center gap-4 rounded-md border border-white/10 bg-[rgba(15,15,35,0.5)] px-5 py-3.5"
              >
                <div className="font-mono text-xs text-ink-deep">#{j.id.slice(0, 6)}</div>
                <div>
                  <div className="truncate text-sm font-semibold">{title}</div>
                  <div className="mt-0.5 text-xs text-ink-deep">{j.progressMsg}</div>
                  {j.status === "failed" && j.error ? (
                    <div className="mt-1 line-clamp-2 text-[11px] text-red-400/80">
                      {j.error.split("\n")[0]}
                    </div>
                  ) : null}
                </div>
                <ProgressBar value={j.progress} />
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.5px] ${statusStyle[j.status]}`}
                >
                  {j.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

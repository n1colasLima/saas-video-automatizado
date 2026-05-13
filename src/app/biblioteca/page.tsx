"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { subscribeJobs } from "@/lib/firebase/jobs";
import type { Job } from "@/lib/types/jobs";

export default function BibliotecaPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => subscribeJobs(setJobs, { limit: 48, statusFilter: ["done"] }), []);

  const ready = jobs.filter((j) => j.videoUrl);

  return (
    <>
      <PageHeader
        eyebrow="BIBLIOTECA"
        title="Seus vídeos."
        subtitle="Reproduza ou baixe os MP4s gerados. Os arquivos vivem no Firebase Storage."
      />

      {ready.length === 0 ? (
        <div className="rounded-md border border-dashed border-white/10 px-6 py-14 text-center text-ink-deep">
          <div className="text-[15px] font-semibold text-ink-muted">
            Nenhum vídeo finalizado ainda
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ready.map((v) => {
            const when = new Date(v.updatedAt).toLocaleString("pt-BR");
            return (
              <div
                key={v.id}
                className="overflow-hidden rounded-md border border-white/10 bg-[rgba(15,15,35,0.5)] transition-all hover:-translate-y-px hover:border-accent/40"
              >
                <div className="aspect-video bg-black">
                  <video
                    src={v.videoUrl!}
                    controls
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-4 py-3.5">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">
                    {v.title ?? "Sem título"}
                  </div>
                  <div className="font-mono text-[11px] text-ink-deep">
                    #{v.id.slice(0, 6)} · {when}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

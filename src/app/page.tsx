"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { subscribeJobs } from "@/lib/firebase/jobs";
import type { Job } from "@/lib/types/jobs";

export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => subscribeJobs(setJobs, { limit: 30 }), []);

  const metrics = useMemo(() => {
    const counts = jobs.reduce(
      (acc, j) => {
        acc[j.status] = (acc[j.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<Job["status"], number>,
    );
    return {
      total: jobs.length,
      queued: counts.queued ?? 0,
      running: counts.running ?? 0,
      done: counts.done ?? 0,
      failed: counts.failed ?? 0,
    };
  }, [jobs]);

  const recent = jobs.filter((j) => j.status === "done" && j.videoUrl).slice(0, 12);

  return (
    <>
      <PageHeader
        eyebrow="DASHBOARD"
        title="Bem-vindo de volta."
        subtitle="Gere vídeos completos de forma autônoma. Acompanhe a fila e revise seus vídeos prontos em um só lugar."
      />

      <div className="mb-7 grid grid-cols-4 gap-3.5">
        <MetricCard label="Total de jobs" value={metrics.total} delta="desde o início" />
        <MetricCard label="Em fila" value={metrics.queued} delta="aguardando" />
        <MetricCard
          label="Em geração"
          value={metrics.running}
          delta="processando agora"
          highlight={metrics.running > 0}
        />
        <MetricCard
          label="Concluídos"
          value={metrics.done}
          delta={`${metrics.failed} falhas`}
        />
      </div>

      <div className="mb-6 flex gap-3">
        <Button asChild size="lg">
          <Link href="/criar/narrado">Novo vídeo narrado</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/criar/fashion">Novo TikTok / Moda</Link>
        </Button>
      </div>

      <h2 className="mb-3 text-base font-semibold text-ink">Vídeos recentes</h2>
      {recent.length === 0 ? (
        <div className="rounded-md border border-dashed border-white/10 px-6 py-14 text-center text-ink-deep">
          <div className="mb-1 text-[15px] font-semibold text-ink-muted">
            Nenhum vídeo gerado ainda
          </div>
          <div>
            Clique em <strong>Novo vídeo</strong> para começar.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {recent.map((v) => (
            <VideoCard key={v.id} job={v} />
          ))}
        </div>
      )}
    </>
  );
}

function MetricCard({
  label,
  value,
  delta,
  highlight,
}: {
  label: string;
  value: number;
  delta: string;
  highlight?: boolean;
}) {
  return (
    <div className="va-card transition-all hover:-translate-y-px hover:border-accent/40">
      <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[1.5px] text-ink-deep">
        {label}
      </div>
      <div className="font-mono text-[32px] font-extrabold leading-none tracking-[-1px] text-ink">
        {value}
      </div>
      <div
        className={`mt-1 text-xs ${highlight ? "text-emerald-500" : "text-ink-deep"}`}
      >
        {delta}
      </div>
    </div>
  );
}

function VideoCard({ job }: { job: Job }) {
  const when = new Date(job.updatedAt).toLocaleString("pt-BR");
  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-[rgba(15,15,35,0.5)] transition-all hover:-translate-y-px hover:border-accent/40">
      <div className="aspect-video bg-black">
        {job.videoUrl ? (
          <video
            src={job.videoUrl}
            controls
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="px-4 py-3.5">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">
          {job.title ?? "Sem título"}
        </div>
        <div className="font-mono text-[11px] text-ink-deep">
          #{job.id.slice(0, 6)} · {when}
        </div>
      </div>
    </div>
  );
}

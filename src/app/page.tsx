"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Film, Sparkles, RefreshCcw } from "lucide-react";

import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Metric, MetricGrid } from "@/components/ui/Metric";
import { Empty } from "@/components/ui/Empty";
import { Button } from "@/components/ui/Button";
import { VideoGrid } from "@/components/feature/VideoGrid";
import {
  completedVideos,
  deriveMetrics,
  useJobs,
} from "@/lib/firebase/jobs-client";

export default function HomePage() {
  const { jobs, loading } = useJobs(60);
  const metrics = useMemo(() => deriveMetrics(jobs), [jobs]);
  const recent = useMemo(() => completedVideos(jobs).slice(0, 12), [jobs]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Dashboard"
        title="Bem-vindo de volta."
        subtitle="Gere vídeos completos de forma autônoma. Acompanhe a fila e revise seus vídeos prontos em um só lugar."
      />

      <MetricGrid>
        <Metric label="Total de jobs" value={metrics.total} delta="desde o início" />
        <Metric label="Em fila" value={metrics.queued} delta="aguardando" />
        <Metric
          label="Em geração"
          value={metrics.running}
          delta={metrics.running ? "processando agora" : "ocioso"}
          deltaTone={metrics.running ? "up" : "muted"}
        />
        <Metric
          label="Concluídos"
          value={metrics.done}
          delta={`${metrics.failed} falhas`}
          deltaTone={metrics.failed ? "down" : "up"}
        />
      </MetricGrid>

      <div className="mb-7 flex flex-wrap gap-3">
        <Link href="/criar/narrado">
          <Button size="lg" className="px-7">
            <Film className="h-4 w-4" />
            Novo vídeo narrado
          </Button>
        </Link>
        <Link href="/criar/fashion">
          <Button size="lg" className="px-7">
            <Sparkles className="h-4 w-4" />
            Novo TikTok / Moda
          </Button>
        </Link>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => window.location.reload()}
        >
          <RefreshCcw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <h2 className="mb-3 text-[15px] font-semibold text-ink">Vídeos recentes</h2>
      {loading ? (
        <Empty title="Carregando..." />
      ) : recent.length === 0 ? (
        <Empty title="Nenhum vídeo gerado ainda">
          Clique em <strong>Novo vídeo narrado</strong> ou{" "}
          <strong>Novo TikTok / Moda</strong> para começar.
        </Empty>
      ) : (
        <VideoGrid jobs={recent} />
      )}
    </PageShell>
  );
}

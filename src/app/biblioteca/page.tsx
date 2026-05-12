"use client";

import { useMemo } from "react";

import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Empty } from "@/components/ui/Empty";
import { VideoGrid } from "@/components/feature/VideoGrid";
import { completedVideos, useJobs } from "@/lib/firebase/jobs-client";

export default function BibliotecaPage() {
  const { jobs, loading } = useJobs(120);
  const videos = useMemo(() => completedVideos(jobs), [jobs]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Biblioteca"
        title="Seus vídeos."
        subtitle={
          <>
            Reproduza ou baixe os MP4s gerados. Os arquivos ficam em{" "}
            <code className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-accent-soft">
              output/
            </code>
            .
          </>
        }
      />

      {loading ? (
        <Empty title="Carregando..." />
      ) : videos.length === 0 ? (
        <Empty title="Nenhum vídeo concluído ainda">
          Quando um job terminar, o MP4 aparece aqui.
        </Empty>
      ) : (
        <VideoGrid jobs={videos} />
      )}
    </PageShell>
  );
}

import { cn } from "@/lib/utils/cn";
import type { JobStatus } from "@/lib/types/jobs";

const LABEL: Record<JobStatus, string> = {
  queued: "Em fila",
  running: "Gerando",
  done: "Concluído",
  failed: "Falhou",
};

const CLS: Record<JobStatus, string> = {
  queued: "bg-slate-400/15 text-slate-300",
  running: "bg-amber-500/15 text-amber-400",
  done: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider",
        CLS[status],
      )}
    >
      {LABEL[status]}
    </span>
  );
}

import { cn } from "@/lib/utils/cn";

interface MetricProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaTone?: "up" | "down" | "muted";
}

export function Metric({ label, value, delta, deltaTone = "muted" }: MetricProps) {
  return (
    <div className="group rounded-[14px] border border-white/[0.08] p-5 transition-all duration-250 hover:-translate-y-0.5 hover:border-accent/30 bg-[linear-gradient(180deg,rgba(30,27,75,0.3)_0%,rgba(15,15,35,0.5)_100%)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
        {label}
      </div>
      <div className="mt-2 font-mono text-[32px] font-extrabold leading-none tracking-tight text-ink">
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1 text-xs",
            deltaTone === "up" && "text-emerald-400",
            deltaTone === "down" && "text-red-400",
            deltaTone === "muted" && "text-ink-deep",
          )}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-7 grid grid-cols-2 gap-3.5 md:grid-cols-4">{children}</div>
  );
}

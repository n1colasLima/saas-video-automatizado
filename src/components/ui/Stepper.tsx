import { cn } from "@/lib/utils/cn";

interface StepperProps {
  steps: string[];
  active: number;
}

export function Stepper({ steps, active }: StepperProps) {
  return (
    <div className="mb-8 flex gap-0">
      {steps.map((name, i) => {
        const state = i === active ? "active" : i < active ? "done" : "idle";
        return (
          <div
            key={name}
            className={cn(
              "flex-1 px-4 py-3 border-b-2 transition-all duration-200",
              state === "active" && "border-accent",
              state === "done" && "border-emerald-500",
              state === "idle" && "border-white/[0.08]",
            )}
          >
            <div
              className={cn(
                "font-mono text-[11px] font-semibold uppercase tracking-[0.1em]",
                state === "active" && "text-accent-soft",
                state === "done" && "text-emerald-400",
                state === "idle" && "text-ink-deep",
              )}
            >
              {`Passo ${String(i + 1).padStart(2, "0")}`}
            </div>
            <div
              className={cn(
                "mt-1 text-[14px] font-semibold",
                state === "idle" ? "text-ink-muted" : "text-ink",
              )}
            >
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils/cn";

interface StepperProps {
  steps: string[];
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="mb-8 flex gap-0">
      {steps.map((name, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <div
            key={i}
            className={cn(
              "flex-1 border-b-2 px-4 py-3 transition-colors",
              state === "done" && "border-emerald-500",
              state === "active" && "border-accent",
              state === "pending" && "border-white/10",
            )}
          >
            <div
              className={cn(
                "font-mono text-[11px] font-semibold uppercase tracking-[1px]",
                state === "active" && "text-accent-soft",
                state === "done" && "text-emerald-500",
                state === "pending" && "text-ink-deep",
              )}
            >
              PASSO {String(i + 1).padStart(2, "0")}
            </div>
            <div
              className={cn(
                "mt-1 text-sm font-semibold",
                state === "pending" ? "text-ink-muted" : "text-ink",
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

"use client";

import * as React from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils/cn";

export interface RadioCardOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

interface RadioCardsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: RadioCardOption<T>[];
  columns?: number;
  className?: string;
}

export function RadioCards<T extends string>({
  value,
  onValueChange,
  options,
  columns = 2,
  className,
}: RadioCardsProps<T>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn(
        "grid gap-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {options.map((opt) => (
        <RadioGroup.Item
          key={opt.value}
          value={opt.value}
          className={cn(
            "group relative flex flex-col items-start gap-1 rounded-md border border-white/10 bg-[rgba(15,15,35,0.6)] px-5 py-4 text-left transition-all duration-150",
            "hover:-translate-y-px hover:border-accent/40",
            "data-[state=checked]:border-accent data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-accent/15 data-[state=checked]:to-[rgba(30,27,75,0.4)] data-[state=checked]:shadow-[0_8px_24px_rgba(225,29,72,0.2)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          )}
        >
          <span className="text-sm font-semibold text-ink">{opt.label}</span>
          {opt.description ? (
            <span className="text-xs text-ink-muted">{opt.description}</span>
          ) : null}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

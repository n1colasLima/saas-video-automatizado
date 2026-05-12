"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";

import { cn } from "@/lib/utils/cn";

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface RadioCardsProps<T extends string> {
  value: T;
  onValueChange: (v: T) => void;
  options: RadioCardOption<T>[];
  className?: string;
}

export function RadioCards<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: RadioCardsProps<T>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn(
        "grid gap-3",
        "grid-cols-[repeat(auto-fit,minmax(240px,1fr))]",
        className,
      )}
    >
      {options.map((opt) => (
        <RadioGroup.Item
          key={opt.value}
          value={opt.value}
          className={cn(
            "group cursor-pointer rounded-[12px] border border-white/10 px-5 py-4 text-left transition-all duration-200",
            "bg-[rgba(15,15,35,0.6)] text-ink-soft hover:-translate-y-px hover:border-accent/40",
            "data-[state=checked]:border-accent",
            "data-[state=checked]:bg-[linear-gradient(135deg,rgba(225,29,72,0.15),rgba(30,27,75,0.4))]",
            "data-[state=checked]:text-ink",
            "data-[state=checked]:shadow-[0_8px_24px_rgba(225,29,72,0.2)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          )}
        >
          <div className="text-[14px] font-semibold leading-tight">{opt.label}</div>
          {opt.description && (
            <div className="mt-1 text-xs text-ink-dim">{opt.description}</div>
          )}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

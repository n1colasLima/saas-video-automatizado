"use client";

import * as RS from "@radix-ui/react-switch";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
}

export function Switch({ checked, onCheckedChange, label }: SwitchProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3">
      <RS.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-5 w-9 rounded-full bg-white/10 transition-colors data-[state=checked]:bg-accent"
      >
        <RS.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
      </RS.Root>
      {label && <span className="text-sm text-ink-soft">{label}</span>}
    </label>
  );
}

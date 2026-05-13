"use client";

import * as React from "react";
import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils/cn";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  className?: string;
}

export function Switch({ checked, onCheckedChange, className }: SwitchProps) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "relative h-6 w-11 rounded-full border border-white/10 bg-white/5 transition-colors",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent/30",
        className,
      )}
    >
      <RadixSwitch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-accent" />
    </RadixSwitch.Root>
  );
}

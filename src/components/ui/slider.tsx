"use client";

import * as React from "react";
import * as RadixSlider from "@radix-ui/react-slider";
import { cn } from "@/lib/utils/cn";

interface SliderProps {
  value: number;
  onValueChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
}: SliderProps) {
  return (
    <RadixSlider.Root
      className={cn("relative flex h-5 w-full touch-none items-center", className)}
      value={[value]}
      onValueChange={(v) => onValueChange(v[0]!)}
      min={min}
      max={max}
      step={step}
    >
      <RadixSlider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-white/10">
        <RadixSlider.Range className="absolute h-full bg-gradient-to-r from-accent to-accent-soft" />
      </RadixSlider.Track>
      <RadixSlider.Thumb className="block h-4 w-4 rounded-full bg-white shadow-[0_2px_8px_rgba(225,29,72,0.5)] outline-none ring-offset-2 ring-offset-bg-base focus-visible:ring-2 focus-visible:ring-accent" />
    </RadixSlider.Root>
  );
}

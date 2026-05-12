"use client";

import * as RS from "@radix-ui/react-slider";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (v: number) => void;
  className?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  className,
}: SliderProps) {
  return (
    <RS.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onValueChange(v[0] ?? min)}
      className={`relative flex h-5 w-full touch-none select-none items-center ${className ?? ""}`}
    >
      <RS.Track className="relative h-1 w-full grow rounded-full bg-white/[0.08]">
        <RS.Range className="absolute h-full rounded-full bg-[linear-gradient(90deg,#E11D48,#FB7185)]" />
      </RS.Track>
      <RS.Thumb
        className="block h-4 w-4 rounded-full bg-white shadow-[0_2px_8px_rgba(225,29,72,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="valor"
      />
    </RS.Root>
  );
}

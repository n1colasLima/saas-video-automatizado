"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface ProgressBarProps {
  value: number; // 0..100
  className?: string;
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <div
        className="h-full bg-gradient-to-r from-accent to-accent-soft transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

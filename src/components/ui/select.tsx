"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface SelectProps<T extends string>
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string }[];
}

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...props
}: SelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value as T)}
      className={cn(
        "h-11 w-full rounded-md border border-white/10 bg-[rgba(15,15,35,0.6)] px-4 text-[15px] text-ink",
        "transition focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        "appearance-none",
        className,
      )}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-bg-panel">
          {o.label}
        </option>
      ))}
    </select>
  );
}

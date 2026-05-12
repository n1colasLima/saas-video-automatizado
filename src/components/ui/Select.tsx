"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "w-full appearance-none rounded-[10px] border border-white/10 bg-[rgba(15,15,35,0.6)] px-3.5 py-2.5 pr-10 text-[15px] text-ink",
      "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394A3B8%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_12px_center]",
      "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[16px] p-6 backdrop-blur-xl",
        "bg-[linear-gradient(180deg,rgba(30,27,75,0.4)_0%,rgba(15,15,35,0.6)_100%)]",
        "border border-white/[0.08]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 pb-3 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-muted border-b border-white/[0.06]">
      {children}
    </div>
  );
}

export function CardHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-dim mt-2">{children}</p>;
}

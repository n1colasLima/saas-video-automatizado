import type { ReactNode } from "react";

interface EmptyProps {
  title: string;
  children?: ReactNode;
}

export function Empty({ title, children }: EmptyProps) {
  return (
    <div className="rounded-[14px] border border-dashed border-white/10 p-14 text-center text-ink-dim">
      <div className="text-[16px] font-semibold text-ink-muted">{title}</div>
      {children && <div className="mt-1.5 text-sm">{children}</div>}
    </div>
  );
}

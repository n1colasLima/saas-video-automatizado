import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
        {eyebrow}
      </div>
      <h1 className="mt-2 bg-[linear-gradient(135deg,#F8FAFC_0%,#94A3B8_100%)] bg-clip-text text-[36px] font-extrabold leading-[1.05] tracking-[-0.04em] text-transparent">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 max-w-[720px] text-[15px] leading-relaxed text-ink-muted">
          {subtitle}
        </p>
      )}
    </header>
  );
}

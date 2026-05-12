import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen flex-1 overflow-y-auto px-12 pb-16 pt-8 bg-[radial-gradient(ellipse_at_top_left,rgba(225,29,72,0.06)_0%,transparent_50%),#07070D]">
      {children}
    </main>
  );
}

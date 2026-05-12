"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Film, Sparkles, ListChecks, Library } from "lucide-react";

import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/criar/narrado", label: "Vídeo narrado", icon: Film },
  { href: "/criar/fashion", label: "TikTok / Moda", icon: Sparkles },
  { href: "/fila", label: "Fila", icon: ListChecks },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
] as const;

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col gap-0 border-r border-white/[0.06] bg-[linear-gradient(180deg,#0F0F23_0%,#08081A_100%)] px-[18px] py-7">
      <div className="mb-4 flex items-center gap-2.5 border-b border-white/[0.06] px-2.5 pb-7 pt-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#E11D48_0%,#BE123C_100%)] font-mono text-[18px] font-bold text-white shadow-[0_4px_16px_rgba(225,29,72,0.4)]">
          T
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight text-ink">Tomada</div>
          <div className="font-mono text-[11px] text-ink-dim">pipeline · v2.0</div>
        </div>
      </div>

      <div className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-deep">
        Navegação
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? path === "/" : path.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[10px] border-l-[3px] border-transparent px-3.5 py-2.5 text-[14px] font-medium transition-all duration-200",
                active
                  ? "border-l-accent bg-accent/[0.12] font-semibold text-accent-soft"
                  : "text-ink-muted hover:bg-white/[0.03] hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[10px] border border-white/[0.05] bg-white/[0.03] p-3.5 text-[11px] leading-relaxed text-ink-dim">
        <strong className="mb-1 block font-semibold text-ink-muted">
          Pipeline ativo
        </strong>
        Worker assíncrono em execução. Vídeos da fila são processados automaticamente.
      </div>
    </aside>
  );
}

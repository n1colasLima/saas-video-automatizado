"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  Clapperboard,
  Film,
  Home,
  ListVideo,
  Library,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Início", icon: Home },
  { href: "/criar/narrado", label: "Vídeo narrado", icon: Film },
  { href: "/criar/fashion", label: "TikTok / Moda", icon: Clapperboard },
  { href: "/fila", label: "Fila", icon: ListVideo },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 flex-shrink-0 flex-col border-r border-white/5 bg-gradient-to-b from-[#0F0F23] to-[#08081A] px-4 py-7">
      <div className="mb-6 flex items-center gap-3 border-b border-white/5 pb-7">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent-dark font-mono text-lg font-bold text-white shadow-[0_4px_16px_rgba(225,29,72,0.4)]">
          T
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight">Tomada</div>
          <div className="font-mono text-[11px] text-ink-deep">pipeline · v0.1</div>
        </div>
      </div>

      <div className="px-2 pb-2 font-mono text-[11px] font-semibold uppercase tracking-[1.5px] text-ink-deep">
        Navegação
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md border-l-2 border-transparent px-3 text-sm font-medium transition-colors",
                active
                  ? "border-l-accent bg-accent/10 font-semibold text-accent-soft"
                  : "text-ink-muted hover:bg-white/5 hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-md border border-white/5 bg-white/[0.03] p-3.5 text-[11px] leading-relaxed text-ink-deep">
        <div className="mb-1 font-semibold text-ink-muted">Worker local</div>
        Rode <code className="font-mono text-accent-soft">npm run worker</code> em outro
        terminal para processar a fila.
      </div>
    </aside>
  );
}

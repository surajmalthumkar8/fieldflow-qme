"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { NAV_GROUPS, navForRole, type Role } from "@/lib/nav";
import { cn } from "@/lib/cn";

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  return C ? <C className={className} /> : null;
}

export function Sidebar({ role = "customer" }: { role?: Role }) {
  const pathname = usePathname();
  const items = navForRole(role);
  return (
    <aside className="relative hidden w-[248px] shrink-0 flex-col bg-ink-950 text-ink-200 lg:flex">
      {/* blueprint texture + corner mesh for depth */}
      <div className="pointer-events-none absolute inset-0 bg-blueprint opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-ink-mesh" />

      <div className="relative flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-signal-500 to-signal-700 shadow-pop">
          <Icons.RadioTower className="h-[18px] w-[18px] text-white" />
        </div>
        <div className="leading-none">
          <div className="font-display text-[15px] font-bold tracking-tightest text-white">
            FieldFlow
          </div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-400">
            Qualified Meetings
          </div>
        </div>
      </div>

      <nav className="relative flex-1 space-y-7 overflow-y-auto px-3 py-5 scroll-thin">
        {NAV_GROUPS.filter((group) => items.some((n) => n.group === group)).map((group) => (
          <div key={group}>
            <div className="px-3 pb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-500">
              {group}
            </div>
            <div className="space-y-0.5">
              {items.filter((n) => n.group === group).map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-white/[0.07] text-white"
                        : "text-ink-300 hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-flare-400" />
                    )}
                    <Icon
                      name={item.icon}
                      className={cn(
                        "h-[17px] w-[17px] shrink-0 transition-colors",
                        active ? "text-flare-400" : "text-ink-400 group-hover:text-ink-200"
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-white/10 p-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-money-400">
            <span className="h-1.5 w-1.5 rounded-full bg-money-400" /> Powered by TechAegisAI
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
            Done-for-you delivery + recorded, attributed ROI — the moat.
          </p>
        </div>
      </div>
    </aside>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Cpu, Sparkles, Building2, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface TopbarBusiness {
  id: string;
  name: string;
  trade: string;
}

export function Topbar({
  businesses,
  activeId,
  brainLive,
}: {
  businesses: TopbarBusiness[];
  activeId: string;
  brainLive: boolean;
}) {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-ink-200/70 bg-paper/80 px-4 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/80 lg:px-8">
      <div className="flex items-center gap-2.5">
        <Building2 className="h-4 w-4 text-ink-400" />
        <span className="text-[13px] font-semibold text-ink-800 dark:text-ink-100">
          {businesses.find((b) => b.id === activeId)?.name ?? "—"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {brainLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-money-50 px-2.5 py-1 text-[11px] font-semibold text-money-700 ring-1 ring-inset ring-money-400/40">
            <Cpu className="h-3 w-3" /> Live Claude Haiku
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-signal-50 px-2.5 py-1 text-[11px] font-semibold text-signal-700 ring-1 ring-inset ring-signal-200">
            <Sparkles className="h-3 w-3" /> Demo brain
          </span>
        )}
        <button
          onClick={onLogout}
          title="Sign out"
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-600 transition-colors hover:border-ink-300 hover:text-ink-800 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:text-white"
        >
          <LogOut className="h-3 w-3" /> Sign out
        </button>
      </div>
    </header>
  );
}

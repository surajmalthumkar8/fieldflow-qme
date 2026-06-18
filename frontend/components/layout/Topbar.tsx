"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Cpu, ChevronDown, Sparkles, Building2, LogOut } from "lucide-react";
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
  const [pending, startTransition] = useTransition();

  async function onSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const businessId = e.target.value;
    await fetch("/api/business/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    startTransition(() => router.refresh());
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-ink-200/70 bg-paper/80 px-4 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/80 lg:px-8">
      <div className="flex items-center gap-2.5">
        <Building2 className="h-4 w-4 text-ink-400" />
        <span className="eyebrow hidden sm:inline">Client</span>
        <div className="relative">
          <select
            value={activeId}
            onChange={onSelect}
            disabled={pending}
            className="num appearance-none rounded-lg border border-ink-200 bg-white py-1.5 pl-3 pr-9 text-[13px] font-semibold text-ink-800 transition-colors hover:border-ink-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        </div>
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

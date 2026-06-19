"use client";

import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";

type Status = "checking" | "online" | "offline";

// Live badge for the real AI engine (local Ollama via the FastAPI backend).
// Polls /api/ai/health so it reflects reality instead of a hardcoded label.
export function EngineStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const r = await fetch("/api/ai/health", { cache: "no-store" });
        const d = await r.json();
        if (active) setStatus(d.online ? "online" : "offline");
      } catch {
        if (active) setStatus("offline");
      }
    }
    void check();
    const id = setInterval(check, 30000); // re-check every 30s
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const cfg = {
    checking: {
      label: "Checking AI…",
      cls: "bg-ink-100 text-ink-500 ring-ink-200 dark:bg-ink-800 dark:text-ink-400 dark:ring-ink-700",
      dot: "bg-ink-400",
    },
    online: {
      label: "AI online · local",
      cls: "bg-money-50 text-money-700 ring-money-400/40 dark:bg-money-500/15 dark:text-money-300 dark:ring-money-500/30",
      dot: "bg-money-500",
    },
    offline: {
      label: "AI offline",
      cls: "bg-danger-50 text-danger-700 ring-danger-300 dark:bg-danger-500/15 dark:text-danger-300 dark:ring-danger-500/30",
      dot: "bg-danger-500",
    },
  }[status];

  return (
    <span
      title={
        status === "online"
          ? "Local AI (Ollama) is running and serving the receptionist"
          : status === "offline"
          ? "The local AI service isn't reachable"
          : "Checking the local AI service…"
      }
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${cfg.cls}`}
    >
      <span className="relative flex h-2 w-2">
        {status === "online" ? (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.dot} opacity-60`} />
        ) : null}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
      </span>
      <Cpu className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

"use client";

import { cn } from "@/lib/cn";
import { pct } from "@/lib/format";

export interface FunnelStageData {
  key: string;
  label: string;
  value: number;
}

// The centerpiece. A vertical funnel: each stage is a centered bar whose width
// is proportional to its count vs. the top of the funnel (Conversations). The
// final "Held" stage is the money stage and renders in green — that is the
// moment a conversation became real recovered revenue.
export function Funnel({ stages }: { stages: FunnelStageData[] }) {
  const top = Math.max(stages[0]?.value ?? 0, 1);

  return (
    <div className="space-y-2.5">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const widthPct = Math.max((stage.value / top) * 100, 6);
        const stepConv = prev && prev > 0 ? stage.value / prev : null;
        const isHeld = stage.key === "held";

        return (
          <div key={stage.key}>
            {stepConv !== null ? (
              <div className="flex items-center justify-center py-0.5">
                <span className="text-[11px] font-medium text-ink-400">
                  <span className="num">{pct(stepConv)}</span> continue
                  <span className="mx-1 text-ink-300">↓</span>
                </span>
              </div>
            ) : null}
            <div className="flex justify-center">
              <div
                style={{ width: `${widthPct}%` }}
                className={cn(
                  "flex min-w-[120px] items-center justify-between rounded-xl px-4 py-3 text-white shadow-sm transition-all",
                  isHeld
                    ? "bg-money-600 ring-2 ring-money-400/40"
                    : "bg-signal-600"
                )}
              >
                <span className="truncate text-xs font-medium opacity-90">
                  {stage.label}
                </span>
                <span className="num ml-3 shrink-0 text-lg font-semibold">
                  {stage.value}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

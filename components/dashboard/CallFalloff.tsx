"use client";

import { cn } from "@/lib/cn";

export interface FalloffDatum {
  key: string;
  label: string;
  value: number;
  // a short "what to do" hint that turns the bucket into an action
  action: string;
}

// "Where calls fall off" — a compact horizontal breakdown of why non-booked
// conversations didn't convert. Computed from Conversation.outcomeReason on
// non-booked convos. Turns lost calls into action buckets, not just a number.
export function CallFalloff({ data }: { data: FalloffDatum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (!total) {
    return (
      <p className="py-8 text-center text-xs text-ink-400">
        Every conversation converted — no fall-off to report.
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const widthPct = Math.max((d.value / max) * 100, 4);
        const sharePct = total ? Math.round((d.value / total) * 100) : 0;
        return (
          <div key={d.key} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-ink-700">{d.label}</span>
              <span className="num text-xs text-ink-500">
                {d.value}
                <span className="ml-1.5 text-ink-300">{sharePct}%</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                style={{ width: `${widthPct}%` }}
                className={cn(
                  "h-full rounded-full bg-ink-400 transition-all",
                  d.key === "needs_human" && "bg-flare-500",
                  d.key === "pricing" && "bg-signal-500"
                )}
              />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-ink-400">{d.action}</p>
          </div>
        );
      })}
    </div>
  );
}

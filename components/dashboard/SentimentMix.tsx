"use client";

import { pct } from "@/lib/format";

export interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
}

// A single stacked bar of caller sentiment across conversations. Money / ink /
// danger — green for positive, ink for neutral, red for negative. Reads at a
// glance: are people leaving these AI calls happy?
export function SentimentMix({ data }: { data: SentimentData }) {
  const total = data.positive + data.neutral + data.negative;

  if (!total) {
    return (
      <p className="py-6 text-center text-xs text-ink-400">
        No analyzed conversations yet.
      </p>
    );
  }

  const segments = [
    { key: "positive", label: "Positive", value: data.positive, bar: "bg-money-500", dot: "bg-money-500" },
    { key: "neutral", label: "Neutral", value: data.neutral, bar: "bg-ink-300", dot: "bg-ink-300" },
    { key: "negative", label: "Negative", value: data.negative, bar: "bg-danger-500", dot: "bg-danger-500" },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100">
        {segments.map((s) => (
          <div
            key={s.key}
            className={s.bar}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            <span className="text-xs text-ink-600">{s.label}</span>
            <span className="num text-xs font-semibold text-ink-800">
              {pct(s.value / total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

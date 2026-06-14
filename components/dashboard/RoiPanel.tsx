"use client";

import { usd } from "@/lib/format";
import { cn } from "@/lib/cn";

// Side-by-side "what you pay" vs "what we made you". The whole pitch in one
// visual: the green bar should dwarf the cost bar. Bars are scaled to the
// larger of the two so the win reads instantly.
export function RoiPanel({
  monthlyCost,
  recoveredRevenue,
  roiMultiple,
}: {
  monthlyCost: number;
  recoveredRevenue: number;
  roiMultiple: number;
}) {
  const max = Math.max(monthlyCost, recoveredRevenue, 1);
  const costPct = Math.max((monthlyCost / max) * 100, 2);
  const revPct = Math.max((recoveredRevenue / max) * 100, 2);

  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-2">
        <span className="num text-4xl font-semibold text-money-600">
          {roiMultiple.toFixed(1)}×
        </span>
        <span className="text-sm text-ink-500">return on what you pay</span>
      </div>

      <Bar
        label="What you pay"
        amount={monthlyCost}
        widthPct={costPct}
        tone="cost"
      />
      <Bar
        label="What we booked & held for you"
        amount={recoveredRevenue}
        widthPct={revPct}
        tone="revenue"
      />

      <p className="text-xs leading-relaxed text-ink-500">
        Net recovered:{" "}
        <span className="num font-semibold text-money-700">
          {usd(recoveredRevenue - monthlyCost)}
        </span>{" "}
        after the monthly fee. Every dollar is tied to a held, attributed job
        below.
      </p>
    </div>
  );
}

function Bar({
  label,
  amount,
  widthPct,
  tone,
}: {
  label: string;
  amount: number;
  widthPct: number;
  tone: "cost" | "revenue";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-ink-600">{label}</span>
        <span
          className={cn(
            "num font-semibold",
            tone === "revenue" ? "text-money-700" : "text-ink-700"
          )}
        >
          {usd(amount)}
        </span>
      </div>
      <div className="h-7 w-full overflow-hidden rounded-lg bg-ink-100">
        <div
          style={{ width: `${widthPct}%` }}
          className={cn(
            "h-full rounded-lg transition-all",
            tone === "revenue" ? "bg-money-600" : "bg-ink-400"
          )}
        />
      </div>
    </div>
  );
}

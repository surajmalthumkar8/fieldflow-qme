"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactUsd, usd } from "@/lib/format";

export interface SourceDatum {
  source: string; // friendly label
  booked: number;
  held: number;
  revenue: number;
}

const COLORS: Record<string, string> = {
  Reactivation: "#3547e6", // signal-600 (cobalt)
  "Inbound voice": "#059669", // money-600 (emerald)
  "Speed to lead": "#f59e0b", // flare-500 (amber)
};
const FALLBACK_COLOR = "#3547e6";

// Revenue recovered per acquisition channel. Reactivation is the onboarding
// "sugar high"; inbound voice is the durable retainer engine — seeing them
// split out is part of the story.
export function SourceBars({ data }: { data: SourceDatum[] }) {
  if (!data.length) {
    return (
      <p className="py-8 text-center text-xs text-ink-400">
        No bookings by source yet.
      </p>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="source"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tickFormatter={(v) => compactUsd(Number(v))}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
            }}
            formatter={(value: number, _name, item) => {
              const d = item?.payload as SourceDatum;
              return [usd(value), `Held revenue (${d.held} held / ${d.booked} booked)`];
            }}
          />
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={64}>
            {data.map((d) => (
              <Cell key={d.source} fill={COLORS[d.source] ?? FALLBACK_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

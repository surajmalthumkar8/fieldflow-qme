"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MessageSquare, Mic, Server, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { chartTheme, useIsDark } from "@/lib/useIsDark";

interface Bucket { used: number; free: number; billable: number }
interface Bill {
  period: string;
  symbol: string;
  total: number;
  usage: { aiMessages: Bucket; tokens: Bucket; voiceMinutes: Bucket; ragMb: Bucket };
}
interface Daily { trend: { date: string; aiCost: number; tokenCost: number; ragCost: number; voiceCost: number }[] }

function shortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function CostAnalyzerPage() {
  const [bill, setBill] = useState<Bill | null>(null);
  const [daily, setDaily] = useState<Daily | null>(null);
  const dark = useIsDark();
  const theme = chartTheme(dark);

  useEffect(() => {
    void fetch("/api/billing/me", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setBill);
    void fetch("/api/billing/me/daily", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { trend: [] })).then(setDaily);
  }, []);

  if (!bill) return <div className="space-y-6"><PageHeader title="Cost Analyzer" description="Your usage and what it costs." /><DashboardSkeleton cards={4} charts={1} /></div>;

  const u = bill.usage;
  const cards = [
    { label: "AI messages", b: u.aiMessages, icon: MessageSquare },
    { label: "Tokens", b: u.tokens, icon: Sparkles },
    { label: "Voice minutes", b: u.voiceMinutes, icon: Mic },
    { label: "RAG ingested (MB)", b: u.ragMb, icon: Server },
  ];

  // Linear run-rate projection for the month.
  const day = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projected = day > 0 ? (bill.total / day) * daysInMonth : bill.total;

  return (
    <div className="space-y-6">
      <PageHeader title="Cost Analyzer" description={`Your usage for ${bill.period}. Costs are estimates from current rates.`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
              <c.icon className="h-3.5 w-3.5 text-signal-500" /> {c.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{Math.round(c.b.used).toLocaleString()}</div>
            <div className="text-xs text-ink-400">
              {c.b.billable > 0 ? `${Math.round(c.b.billable).toLocaleString()} billable` : `within ${Math.round(c.b.free).toLocaleString()} free`}
            </div>
            {/* allowance bar */}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
              <div className="h-full bg-signal-500" style={{ width: `${Math.min(100, c.b.free ? (c.b.used / c.b.free) * 100 : 0)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
          <div className="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">Cost so far this month</div>
          <div className="mt-1 text-3xl font-semibold text-ink-900 dark:text-ink-100">{bill.symbol}{bill.total}</div>
        </div>
        <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
          <div className="text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">Projected month-end (run-rate)</div>
          <div className="mt-1 text-3xl font-semibold text-ink-900 dark:text-ink-100">{bill.symbol}{projected.toFixed(2)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
        <h2 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Daily cost by type</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={daily?.trend ?? []} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} width={32} />
            <Tooltip labelFormatter={(l) => shortDate(String(l))} contentStyle={{ fontSize: 12, borderRadius: 8, ...theme.tooltip }} labelStyle={{ color: theme.tooltip.color }} itemStyle={{ color: theme.tooltip.color }} />
            <Area type="monotone" dataKey="aiCost" name="AI" stackId="1" stroke="#6366f1" fill="#6366f155" />
            <Area type="monotone" dataKey="tokenCost" name="Tokens" stackId="1" stroke="#0ea5e9" fill="#0ea5e955" />
            <Area type="monotone" dataKey="ragCost" name="RAG" stackId="1" stroke="#10b981" fill="#10b98155" />
            <Area type="monotone" dataKey="voiceCost" name="Voice" stackId="1" stroke="#f59e0b" fill="#f59e0b55" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

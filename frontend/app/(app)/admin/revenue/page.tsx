"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, DollarSign, Repeat, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { chartTheme, useIsDark } from "@/lib/useIsDark";

interface CompanyRow {
  businessId: string;
  companyName?: string;
  usage: { aiMessages: number; tokens: number; voiceMinutes: number; ragMb: number };
  bill: number;
  status: string;
}
interface Revenue {
  symbol: string;
  summary: { totalRevenue?: number; mrr?: number; activeCompanies?: number; platformFeeRevenue?: number; usageRevenue?: number };
  companies: CompanyRow[];
  trend: { period: string; revenue: number }[];
}

export default function RevenuePage() {
  const [data, setData] = useState<Revenue | null>(null);
  const dark = useIsDark();
  const theme = chartTheme(dark);

  useEffect(() => {
    void fetch("/api/admin/billing", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setData);
  }, []);

  if (!data) return <div className="space-y-6"><PageHeader title="Revenue" description="What we earn across all companies." /><DashboardSkeleton cards={4} charts={1} /></div>;

  const s = data.summary;
  const sym = data.symbol || "$";
  const cards = [
    { label: "Total revenue (period)", value: `${sym}${(s.totalRevenue ?? 0).toFixed(2)}`, icon: DollarSign },
    { label: "MRR", value: `${sym}${(s.mrr ?? 0).toFixed(2)}`, icon: Repeat },
    { label: "Active companies", value: s.activeCompanies ?? 0, icon: Building2 },
    { label: "Platform vs usage", value: `${sym}${(s.platformFeeRevenue ?? 0).toFixed(0)} / ${sym}${(s.usageRevenue ?? 0).toFixed(0)}`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue" description="What the platform earns across every company — our billing revenue (not client pipeline)." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
              <c.icon className="h-3.5 w-3.5 text-money-500" /> {c.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
        <h2 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Revenue trend</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.5} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} />
            <YAxis tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} width={44} tickFormatter={(v) => `${sym}${v}`} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, ...theme.tooltip }} labelStyle={{ color: theme.tooltip.color }} itemStyle={{ color: theme.tooltip.color }} formatter={(v) => `${sym}${v}`} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#rev)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 text-right font-semibold">AI msgs</th>
              <th className="px-4 py-3 text-right font-semibold">Tokens</th>
              <th className="px-4 py-3 text-right font-semibold">RAG MB</th>
              <th className="px-4 py-3 text-right font-semibold">Bill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {data.companies.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">No billable usage yet.</td></tr>
            ) : (
              data.companies.map((c) => (
                <tr key={c.businessId} className="hover:bg-paper-50 dark:hover:bg-ink-800/40">
                  <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-ink-100">{c.companyName}</td>
                  <td className="px-4 py-2.5 text-right num text-ink-600 dark:text-ink-300">{c.usage.aiMessages.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right num text-ink-600 dark:text-ink-300">{c.usage.tokens.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right num text-ink-600 dark:text-ink-300">{c.usage.ragMb}</td>
                  <td className="px-4 py-2.5 text-right num font-semibold text-money-600 dark:text-money-400">{sym}{c.bill.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

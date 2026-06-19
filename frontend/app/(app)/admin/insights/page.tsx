"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, CalendarCheck, MessageSquare, Percent, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { chartTheme, useIsDark } from "@/lib/useIsDark";

interface Totals {
  totalCompanies?: number;
  activeCompanies?: number;
  conversations?: number;
  bookings?: number;
  messages?: number;
  aiMessages?: number;
  avgMessagesPerConversation?: number;
  conversionRate?: number;
  agents?: number;
  customers?: number;
}
interface TrendPoint {
  date: string;
  conversations: number;
  bookings: number;
}
interface CompanyRow {
  businessId: string;
  companyName?: string;
  conversations: number;
  bookings: number;
  lastActive: string | null;
}
interface Insights {
  totals: Totals;
  trend: TrendPoint[];
  byCompany: CompanyRow[];
}

const BAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

function shortDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const dark = useIsDark();
  const theme = chartTheme(dark);

  useEffect(() => {
    void fetch("/api/admin/insights", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { totals: {}, trend: [], byCompany: [] }))
      .then(setData);
  }, []);

  const t = data?.totals ?? {};
  const stats = [
    { label: "Companies", value: `${t.activeCompanies ?? 0}/${t.totalCompanies ?? 0}`, sub: "active / onboarded", icon: Building2 },
    { label: "AI conversations", value: t.conversations ?? 0, sub: `${t.aiMessages ?? 0} AI replies`, icon: Sparkles },
    { label: "Calls booked by AI", value: t.bookings ?? 0, sub: "across all companies", icon: CalendarCheck },
    { label: "Booking conversion", value: `${Math.round((t.conversionRate ?? 0) * 100)}%`, sub: "convos → booked", icon: Percent },
    { label: "Avg messages / convo", value: t.avgMessagesPerConversation ?? 0, sub: "engagement depth", icon: MessageSquare },
    { label: "Agents & customers", value: `${t.agents ?? 0} / ${t.customers ?? 0}`, sub: "on the platform", icon: Users },
  ];

  const topCompanies = useMemo(
    () => (data?.byCompany ?? []).slice(0, 6).map((c) => ({ name: c.companyName || "—", conversations: c.conversations })),
    [data]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Insights"
        description="How our AI receptionist is performing across every company — adoption, engagement and conversion. Product metrics only; each company's revenue stays private to them."
      />

      {data === null ? (
        <DashboardSkeleton cards={6} charts={1} />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                  <s.icon className="h-3.5 w-3.5 text-signal-500" /> {s.label}
                </div>
                <div className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{s.value}</div>
                <div className="text-xs text-ink-400">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Activity trend */}
          <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
            <h2 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Activity — last {data.trend.length} days</h2>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gBook" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} width={28} />
                <Tooltip
                  labelFormatter={(l) => shortDate(String(l))}
                  contentStyle={{ fontSize: 12, borderRadius: 8, ...theme.tooltip }}
                  labelStyle={{ color: theme.tooltip.color }}
                  itemStyle={{ color: theme.tooltip.color }}
                />
                <Area type="monotone" dataKey="conversations" name="Conversations" stroke="#6366f1" strokeWidth={2} fill="url(#gConv)" />
                <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#10b981" strokeWidth={2} fill="url(#gBook)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-1 flex gap-4 text-xs text-ink-500 dark:text-ink-400">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#6366f1]" /> Conversations</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#10b981]" /> Bookings</span>
            </div>
          </div>

          {/* Adoption by company */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <h2 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Adoption — conversations by company</h2>
              {topCompanies.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-400">No activity yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={topCompanies} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={theme.grid} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, ...theme.tooltip }}
                      labelStyle={{ color: theme.tooltip.color }}
                      itemStyle={{ color: theme.tooltip.color }}
                      cursor={{ fill: theme.cursor }}
                    />
                    <Bar dataKey="conversations" radius={[0, 4, 4, 0]}>
                      {topCompanies.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Per-company table */}
            <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-100 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 text-right font-semibold">Convos</th>
                    <th className="px-4 py-3 text-right font-semibold">Booked</th>
                    <th className="px-4 py-3 text-right font-semibold">Last active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {(data.byCompany ?? []).length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-400">No companies yet.</td></tr>
                  ) : (
                    data.byCompany.map((c) => (
                      <tr key={c.businessId} className="hover:bg-paper-50 dark:hover:bg-ink-800/40">
                        <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-ink-100">{c.companyName || "—"}</td>
                        <td className="px-4 py-2.5 text-right num text-ink-700 dark:text-ink-300">{c.conversations}</td>
                        <td className="px-4 py-2.5 text-right num text-money-600 dark:text-money-400">{c.bookings || "—"}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-ink-400">
                          {c.lastActive ? new Date(c.lastActive).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

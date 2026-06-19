"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarCheck, DollarSign, Flame, MessageSquare, Sparkles, TrendingDown, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { compactUsd } from "@/lib/format";
import { chartTheme, useIsDark } from "@/lib/useIsDark";

interface Totals {
  conversations?: number;
  bookings?: number;
  bookingRate?: number;
  hotLeads?: number;
  pipeline?: number;
  activeAgents?: number;
  qualificationRate?: number;
  dropOffRate?: number;
  avgMessagesToBook?: number;
}
interface Overview {
  totals: Totals;
  gradeMix: Record<string, number>;
  funnel: { conversations?: number; engaged?: number; qualified?: number; booked?: number };
  trend: { date: string; conversations: number; bookings: number }[];
}

const GRADE_COLORS: Record<string, string> = { HOT: "#ef4444", WARM: "#f59e0b", COLD: "#0ea5e9" };

function usd(n: number) {
  return compactUsd(n || 0);
}
function pct(n: number) {
  return `${Math.round((n ?? 0) * 100)}%`;
}
function shortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const dark = useIsDark();
  const theme = chartTheme(dark);

  useEffect(() => {
    void fetch("/api/admin/overview", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { totals: {}, gradeMix: {}, funnel: {}, trend: [] }))
      .then(setData);
  }, []);

  const t = data?.totals ?? {};
  const cards = [
    { label: "Conversations", value: t.conversations ?? 0, icon: Sparkles },
    { label: "Calls booked", value: t.bookings ?? 0, icon: CalendarCheck },
    { label: "Booking rate", value: pct(t.bookingRate ?? 0), icon: TrendingDown },
    { label: "Hot leads", value: t.hotLeads ?? 0, icon: Flame },
    { label: "Est. pipeline", value: usd(t.pipeline ?? 0), icon: DollarSign },
    { label: "Active agents", value: t.activeAgents ?? 0, icon: Users },
  ];

  const gradeData = Object.entries(data?.gradeMix ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const f = data?.funnel ?? {};
  const funnelData = [
    { stage: "Conversations", value: f.conversations ?? 0 },
    { stage: "Engaged", value: f.engaged ?? 0 },
    { stage: "Qualified", value: f.qualified ?? 0 },
    { stage: "Booked", value: f.booked ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Your company at a glance — how the AI receptionist is capturing and converting leads. Revenue figures are estimates from stated budgets."
      />

      {data === null ? (
        <DashboardSkeleton cards={6} charts={1} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                  <c.icon className="h-3.5 w-3.5 text-signal-500" /> {c.label}
                </div>
                <div className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{c.value}</div>
              </div>
            ))}
          </div>

          {/* Activity trend */}
          <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
            <h2 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Activity — last {data.trend.length} days</h2>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="oc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ob" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} width={28} />
                <Tooltip labelFormatter={(l) => shortDate(String(l))} contentStyle={{ fontSize: 12, borderRadius: 8, ...theme.tooltip }} labelStyle={{ color: theme.tooltip.color }} itemStyle={{ color: theme.tooltip.color }} />
                <Area type="monotone" dataKey="conversations" name="Conversations" stroke="#6366f1" strokeWidth={2} fill="url(#oc)" />
                <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#10b981" strokeWidth={2} fill="url(#ob)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* AI conversion funnel */}
            <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <h2 className="mb-1 text-sm font-semibold text-ink-800 dark:text-ink-100">AI conversion funnel</h2>
              <p className="mb-3 text-xs text-ink-400">
                How Elara moves visitors toward a booked call · avg {t.avgMessagesToBook ?? 0} messages to book · {pct(t.dropOffRate ?? 0)} drop off after one message
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 16, left: 24, bottom: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={theme.grid} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} />
                  <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, ...theme.tooltip }} labelStyle={{ color: theme.tooltip.color }} itemStyle={{ color: theme.tooltip.color }} cursor={{ fill: theme.cursor }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#6366f1">
                    {funnelData.map((_, i) => (
                      <Cell key={i} fill={["#6366f1", "#0ea5e9", "#f59e0b", "#10b981"][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Lead grade mix */}
            <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <h2 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Lead quality mix</h2>
              {gradeData.length === 0 ? (
                <p className="py-12 text-center text-sm text-ink-400">No leads yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={gradeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {gradeData.map((g) => (
                        <Cell key={g.name} fill={GRADE_COLORS[g.name] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, ...theme.tooltip }} itemStyle={{ color: theme.tooltip.color }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="mt-2 flex justify-center gap-4 text-xs text-ink-500 dark:text-ink-400">
                {Object.entries(GRADE_COLORS).map(([g, c]) => (
                  <span key={g} className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: c }} /> {g} {data.gradeMix?.[g] ?? 0}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs text-ink-400">
            Pipeline values are rough estimates parsed from stated budgets, not signed deals.
          </p>
        </>
      )}
    </div>
  );
}

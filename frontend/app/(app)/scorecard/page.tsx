"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, Clock, MessageSquare, Star, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { chartTheme, useIsDark } from "@/lib/useIsDark";

interface Scorecard {
  carried?: number;
  booked?: number;
  conversion?: number;
  avgFirstContactHours?: number | null;
  avgResponseHours?: number | null;
  messagesSent?: number;
  staleCount?: number;
  avgRating?: number | null;
  ratingCount?: number;
  trend?: { date: string; messages: number }[];
}

function hrs(n?: number | null) {
  return n == null ? "—" : n < 1 ? `${Math.round(n * 60)}m` : `${n}h`;
}
function shortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ScorecardPage() {
  const [data, setData] = useState<Scorecard | null>(null);
  const dark = useIsDark();
  const theme = chartTheme(dark);

  useEffect(() => {
    void fetch("/api/agent/scorecard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then(setData);
  }, []);

  const cards = [
    { label: "Customers carried", value: data?.carried ?? 0, icon: Users, ok: true },
    { label: "Calls booked", value: data?.booked ?? 0, icon: CalendarCheck, ok: true },
    { label: "Conversion", value: `${Math.round((data?.conversion ?? 0) * 100)}%`, icon: TrendingUp, ok: (data?.conversion ?? 0) >= 0.2 },
    { label: "Avg first contact", value: hrs(data?.avgFirstContactHours), icon: Clock, ok: (data?.avgFirstContactHours ?? 0) <= 2 },
    { label: "Avg response time", value: hrs(data?.avgResponseHours), icon: Clock, ok: (data?.avgResponseHours ?? 0) <= 1 },
    { label: "Messages sent", value: data?.messagesSent ?? 0, icon: MessageSquare, ok: true },
    { label: "Aging customers", value: data?.staleCount ?? 0, icon: Clock, ok: (data?.staleCount ?? 0) === 0 },
    { label: "Avg rating", value: data?.avgRating == null ? "—" : `${data.avgRating}★`, icon: Star, ok: (data?.avgRating ?? 5) >= 4 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Performance"
        description="How you're doing with your customers — responsiveness, bookings, effort and how they rate you."
      />

      {data === null ? (
        <DashboardSkeleton cards={8} charts={1} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
                  <span className="inline-flex items-center gap-1.5"><c.icon className="h-3.5 w-3.5 text-signal-500" /> {c.label}</span>
                  <span className={`h-2 w-2 rounded-full ${c.ok ? "bg-money-500" : "bg-danger-500"}`} />
                </div>
                <div className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{c.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
            <h2 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Your activity — last 14 days</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.trend ?? []} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="sc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} width={28} />
                <Tooltip labelFormatter={(l) => shortDate(String(l))} contentStyle={{ fontSize: 12, borderRadius: 8, ...theme.tooltip }} labelStyle={{ color: theme.tooltip.color }} itemStyle={{ color: theme.tooltip.color }} />
                <Area type="monotone" dataKey="messages" name="Messages sent" stroke="#6366f1" strokeWidth={2} fill="url(#sc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

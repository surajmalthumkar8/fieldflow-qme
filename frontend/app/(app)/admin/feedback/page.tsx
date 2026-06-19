"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bug, Lightbulb, Loader2, MessageSquare, Sparkles, Star, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { chartTheme, useIsDark } from "@/lib/useIsDark";

interface FeedbackItem {
  id: string;
  rating: number;
  comment: string;
  category: string;
  source: string;
  sentiment: string;
  escalated: boolean;
  createdAt: string | null;
}
interface FeedbackData {
  viewerRole?: string;
  totals: { count?: number; avgRating?: number; escalated?: number };
  byCategory: Record<string, number>;
  byRating: Record<string, number>;
  trend: { date: string; avg: number; count: number }[];
  items: FeedbackItem[];
}
interface Escalation {
  id: string;
  companyName?: string;
  rating: number;
  comment: string;
  category: string;
  note: string;
  createdAt: string | null;
}
interface Summary {
  summary: string;
  sentiment_breakdown: { positive: number; neutral: number; negative: number };
  themes: { label: string; mentions: number; sentiment: string }[];
  top_feature_requests: { request: string; mentions: number; rationale: string }[];
  bugs: { issue: string; severity: string; mentions: number }[];
  recommendations: { action: string; priority: string; rationale: string }[];
  count?: number;
}

const PRIORITY: Record<string, string> = {
  P0: "bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-500/15 dark:text-danger-300 dark:ring-danger-500/30",
  P1: "bg-flare-50 text-flare-700 ring-flare-300 dark:bg-flare-500/15 dark:text-flare-300 dark:ring-flare-500/30",
  P2: "bg-signal-50 text-signal-700 ring-signal-200 dark:bg-signal-500/15 dark:text-signal-300 dark:ring-signal-500/30",
};

export default function FeedbackPage() {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const dark = useIsDark();
  const theme = chartTheme(dark);
  const isSuper = data?.viewerRole === "super_admin";

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/feedback", { cache: "no-store" });
    const d = r.ok ? await r.json() : { totals: {}, byCategory: {}, byRating: {}, trend: [], items: [] };
    setData(d);
    if (d.viewerRole === "super_admin") {
      const e = await fetch("/api/admin/feedback/escalations", { cache: "no-store" }).catch(() => null);
      setEscalations(e && e.ok ? (await e.json()).items ?? [] : []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function escalate(id: string) {
    const note = window.prompt("Add a note for the platform team (optional):") ?? "";
    const r = await fetch(`/api/admin/feedback/${id}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (r.ok) await load();
  }

  async function summarize() {
    setSummarizing(true);
    const r = await fetch("/api/admin/feedback/summary", { method: "POST" });
    setSummary(r.ok ? await r.json() : null);
    setSummarizing(false);
  }

  const t = data?.totals ?? {};
  const ratingData = Object.entries(data?.byRating ?? {}).map(([k, v]) => ({ stars: `${k}★`, count: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback"
        description="What customers say about the AI receptionist. Use the AI summary to see themes, bugs and feature requests — prioritized."
      />

      {data === null ? (
        <DashboardSkeleton cards={3} charts={1} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400"><Star className="h-3.5 w-3.5 text-flare-500" /> Avg rating</div>
              <div className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{t.avgRating ?? 0} <span className="text-base text-ink-400">/ 5</span></div>
            </div>
            <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400"><MessageSquare className="h-3.5 w-3.5 text-signal-500" /> Responses</div>
              <div className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{t.count ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400"><TrendingUp className="h-3.5 w-3.5 text-money-500" /> Categories</div>
              <div className="mt-1 text-sm text-ink-700 dark:text-ink-200">
                {Object.keys(data.byCategory).length ? Object.entries(data.byCategory).map(([c, n]) => `${c.replace("_", " ")} ${n}`).join(" · ") : "—"}
              </div>
            </div>
          </div>

          {/* Escalations inbox (super_admin) */}
          {isSuper && escalations.length > 0 ? (
            <div className="rounded-2xl border border-flare-200 bg-flare-50/50 p-4 shadow-card dark:border-flare-500/30 dark:bg-flare-500/10">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
                <TrendingUp className="h-4 w-4 text-flare-500" /> Escalations from company admins ({escalations.length})
              </h2>
              <div className="space-y-2">
                {escalations.map((e) => (
                  <div key={e.id} className="rounded-lg border border-ink-200/70 bg-white p-2.5 text-sm dark:border-ink-700 dark:bg-ink-900">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink-800 dark:text-ink-100">{e.companyName}</span>
                      <span className="text-flare-500">{"★".repeat(e.rating)}<span className="text-ink-300 dark:text-ink-600">{"★".repeat(5 - e.rating)}</span></span>
                    </div>
                    {e.comment ? <p className="mt-0.5 text-ink-700 dark:text-ink-300">{e.comment}</p> : null}
                    {e.note ? <p className="mt-0.5 text-xs italic text-ink-500 dark:text-ink-400">Admin note: {e.note}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* AI summary */}
          <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
                <Sparkles className="h-4 w-4 text-signal-500" /> AI feedback summary
              </h2>
              <button
                onClick={summarize}
                disabled={summarizing || (t.count ?? 0) === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-signal-700 disabled:opacity-50"
              >
                {summarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {summary ? "Refresh" : "Summarize"}
              </button>
            </div>
            {summarizing ? (
              <p className="mt-3 text-sm text-ink-400">Reading feedback with the local AI…</p>
            ) : summary ? (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-ink-700 dark:text-ink-200">{summary.summary}</p>
                {summary.recommendations?.length ? (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Recommended priorities</div>
                    <div className="space-y-1.5">
                      {summary.recommendations.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ${PRIORITY[r.priority] || PRIORITY.P2}`}>{r.priority}</span>
                          <span className="text-ink-700 dark:text-ink-200">{r.action}{r.rationale ? <span className="text-ink-400"> — {r.rationale}</span> : null}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  {summary.top_feature_requests?.length ? (
                    <div>
                      <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ink-400"><Lightbulb className="h-3.5 w-3.5" /> Feature requests</div>
                      <ul className="space-y-1 text-sm text-ink-700 dark:text-ink-200">
                        {summary.top_feature_requests.map((f, i) => <li key={i}>• {f.request}{f.mentions ? <span className="text-ink-400"> ({f.mentions})</span> : null}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {summary.bugs?.length ? (
                    <div>
                      <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ink-400"><Bug className="h-3.5 w-3.5" /> Bugs</div>
                      <ul className="space-y-1 text-sm text-ink-700 dark:text-ink-200">
                        {summary.bugs.map((b, i) => <li key={i}>• {b.issue} <span className="text-ink-400">({b.severity})</span></li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-400">Click Summarize to have the local AI group feedback into themes, bugs, feature requests and priorities.</p>
            )}
          </div>

          {/* Rating distribution + raw list */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <h2 className="mb-3 text-sm font-semibold text-ink-800 dark:text-ink-100">Rating distribution</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ratingData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="stars" tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: theme.axis }} stroke={theme.grid} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, ...theme.tooltip }} labelStyle={{ color: theme.tooltip.color }} itemStyle={{ color: theme.tooltip.color }} cursor={{ fill: theme.cursor }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {ratingData.map((_, i) => <Cell key={i} fill={["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981"][i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-ink-100 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
                    <tr><th className="px-4 py-2.5 font-semibold">Rating</th><th className="px-4 py-2.5 font-semibold">Comment</th>{!isSuper ? <th className="px-4 py-2.5" /> : null}</tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {data.items.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-ink-400">No feedback yet.</td></tr>
                    ) : (
                      data.items.map((it) => (
                        <tr key={it.id} className="align-top">
                          <td className="whitespace-nowrap px-4 py-2.5 text-flare-500">{"★".repeat(it.rating)}<span className="text-ink-300 dark:text-ink-600">{"★".repeat(5 - it.rating)}</span></td>
                          <td className="px-4 py-2.5 text-ink-700 dark:text-ink-300">{it.comment || <span className="text-ink-400">—</span>}<div className="text-[11px] text-ink-400">{it.category.replace("_", " ")}</div></td>
                          {!isSuper ? (
                            <td className="px-4 py-2.5 text-right">
                              {it.escalated ? (
                                <span className="text-[11px] font-medium text-money-600 dark:text-money-400">Escalated</span>
                              ) : (
                                <button onClick={() => escalate(it.id)} className="text-[11px] font-medium text-signal-600 hover:underline dark:text-signal-400">Escalate</button>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

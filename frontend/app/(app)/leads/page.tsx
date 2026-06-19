"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Loader2, Repeat, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { compactUsd } from "@/lib/format";

interface Lead {
  id: string;
  name: string;
  email: string;
  grade: string;
  score: number;
  budgetEstimate: number;
  opportunity: number;
  rationale: string;
  profile: Record<string, string>;
  bookedAt: string | null;
  assignedAgentName: string;
  reachedOutCount?: number;
  lastActiveAt?: string | null;
}

function relTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const GRADE: Record<string, string> = {
  HOT: "bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-500/15 dark:text-danger-300 dark:ring-danger-500/30",
  WARM: "bg-flare-50 text-flare-700 ring-flare-300 dark:bg-flare-500/15 dark:text-flare-300 dark:ring-flare-500/30",
  COLD: "bg-signal-50 text-signal-700 ring-signal-200 dark:bg-signal-500/15 dark:text-signal-300 dark:ring-signal-500/30",
};

function usd(n: number) {
  return n ? compactUsd(n) : "—";
}
function wants(l: Lead) {
  const p = l.profile || {};
  const parts = [p.intent, p.propertyType, p.location, p.budget && `budget ${p.budget}`, p.timeline].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export default function AgentLeadsPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/agent/leads", { cache: "no-store" });
    setLeads(r.ok ? await r.json() : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function take(id: string) {
    setAssigning(id);
    await fetch(`/api/agent/leads/${id}/assign`, { method: "POST" });
    await load();
    setAssigning(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Everyone who reached out to your AI receptionist — auto-graded, with what they want. Claim a lead to follow up."
      />

      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Looking for</th>
              <th className="px-4 py-3 font-semibold">Grade</th>
              <th className="px-4 py-3 font-semibold">Budget</th>
              <th className="px-4 py-3 font-semibold">Call</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {leads === null ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-400">
                  No leads yet — they appear here when customers chat with your AI receptionist.
                </td>
              </tr>
            ) : (
              leads.map((l) => (
                <tr key={l.id} className="align-top hover:bg-paper-50 dark:hover:bg-ink-800/40">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium text-ink-900 hover:text-signal-600 dark:text-ink-100 dark:hover:text-signal-400">
                      {l.name}
                    </Link>
                    <div className="text-xs text-ink-400">{l.email || "—"}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                      {l.reachedOutCount && l.reachedOutCount > 1 ? (
                        <span className="inline-flex items-center gap-0.5"><Repeat className="h-3 w-3" /> reached {l.reachedOutCount}×</span>
                      ) : null}
                      {l.lastActiveAt ? <span>· {relTime(l.lastActiveAt)}</span> : null}
                    </div>
                  </td>
                  <td className="max-w-[18rem] px-4 py-3 text-ink-700 dark:text-ink-300">
                    <div>{wants(l)}</div>
                    {l.rationale ? <div className="mt-0.5 text-xs text-ink-400">{l.rationale}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${GRADE[l.grade] || "bg-ink-100 text-ink-500 ring-ink-200 dark:bg-ink-800 dark:text-ink-400 dark:ring-ink-700"}`}>
                      {l.grade}
                      {l.score ? ` ${l.score}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 num text-ink-700 dark:text-ink-300">{usd(l.budgetEstimate)}</td>
                  <td className="px-4 py-3 text-ink-700 dark:text-ink-300">
                    {l.bookedAt ? (
                      <span className="inline-flex items-center gap-1 text-money-600 dark:text-money-400">
                        <CalendarCheck className="h-3.5 w-3.5" />
                        {new Date(l.bookedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {l.assignedAgentName ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-700 dark:text-ink-300">
                        <UserCheck className="h-3.5 w-3.5 text-money-500" /> {l.assignedAgentName}
                      </span>
                    ) : (
                      <button
                        onClick={() => take(l.id)}
                        disabled={assigning === l.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-signal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-signal-700 disabled:opacity-60"
                      >
                        {assigning === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        I&apos;ll take this
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

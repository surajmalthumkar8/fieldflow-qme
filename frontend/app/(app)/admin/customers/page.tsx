"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { compactUsd } from "@/lib/format";

interface Lead {
  id: string;
  name: string;
  email: string;
  grade: string;
  score: number;
  budgetEstimate: number;
  profile: Record<string, string>;
  bookedAt: string | null;
  assignedAgentId: string | null;
  assignedAgentName: string;
}
interface Agent {
  id: string;
  email: string;
  full_name: string;
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

export default function AdminCustomersPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filter, setFilter] = useState<"all" | "HOT" | "unassigned" | "booked">("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [l, a] = await Promise.all([
      fetch("/api/agent/leads", { cache: "no-store" }),
      fetch("/api/admin/agents", { cache: "no-store" }),
    ]);
    setLeads(l.ok ? await l.json() : []);
    setAgents(a.ok ? await a.json() : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function assign(leadId: string, agentId: string) {
    if (!agentId) return;
    const agent = agents.find((a) => a.id === agentId);
    setSavingId(leadId);
    await fetch(`/api/agent/leads/${leadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, agent_name: agent?.full_name || agent?.email || "" }),
    });
    await load();
    setSavingId(null);
  }

  const shown = useMemo(() => {
    const list = leads ?? [];
    if (filter === "HOT") return list.filter((l) => l.grade === "HOT");
    if (filter === "unassigned") return list.filter((l) => !l.assignedAgentId);
    if (filter === "booked") return list.filter((l) => l.bookedAt);
    return list;
  }, [leads, filter]);

  const stats = useMemo(() => {
    const list = leads ?? [];
    const hot = list.filter((l) => l.grade === "HOT").length;
    const booked = list.filter((l) => l.bookedAt).length;
    const unassigned = list.filter((l) => !l.assignedAgentId).length;
    return { total: list.length, hot, booked, unassigned };
  }, [leads]);

  const filters: { key: typeof filter; label: string }[] = [
    { key: "all", label: `All ${stats.total}` },
    { key: "HOT", label: `Hot ${stats.hot}` },
    { key: "unassigned", label: `Unassigned ${stats.unassigned}` },
    { key: "booked", label: `Booked ${stats.booked}` },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Everyone who reached out to your AI receptionist — auto-graded with what they want. Assign each to an agent to follow up."
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filter === f.key
                ? "bg-signal-600 text-white"
                : "bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Looking for</th>
              <th className="px-4 py-3 font-semibold">Grade</th>
              <th className="px-4 py-3 font-semibold">Budget</th>
              <th className="px-4 py-3 font-semibold">Call</th>
              <th className="px-4 py-3 font-semibold">Assigned agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {leads === null ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-400">No customers match this filter.</td></tr>
            ) : (
              shown.map((l) => (
                <tr key={l.id} className="align-top hover:bg-paper-50 dark:hover:bg-ink-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink-900 dark:text-ink-100">{l.name}</div>
                    <div className="text-xs text-ink-400">{l.email || "—"}</div>
                  </td>
                  <td className="max-w-[16rem] px-4 py-3 text-ink-700 dark:text-ink-300">{wants(l)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${GRADE[l.grade] || "bg-ink-100 text-ink-500 ring-ink-200 dark:bg-ink-800 dark:text-ink-400 dark:ring-ink-700"}`}>
                      {l.grade}{l.score ? ` ${l.score}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 num text-ink-700 dark:text-ink-300">{usd(l.budgetEstimate)}</td>
                  <td className="px-4 py-3 text-ink-700 dark:text-ink-300">
                    {l.bookedAt ? (
                      <span className="inline-flex items-center gap-1 text-money-600 dark:text-money-400">
                        <CalendarCheck className="h-3.5 w-3.5" />
                        {new Date(l.bookedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        value={l.assignedAgentId || ""}
                        disabled={savingId === l.id}
                        onChange={(e) => assign(l.id, e.target.value)}
                        className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-700 focus:border-signal-400 focus:outline-none disabled:opacity-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
                      >
                        <option value="">Unassigned</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
                        ))}
                      </select>
                      {savingId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" /> : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {agents.length === 0 ? (
        <p className="text-xs text-ink-400">No agents yet — invite agents on the “My Agents” page to assign customers to them.</p>
      ) : null}
    </div>
  );
}

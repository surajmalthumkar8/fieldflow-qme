"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Clock, DollarSign, Info, Loader2, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { compactUsd } from "@/lib/format";

function SlaCard({ label, value, ok, hint }: { label: string; value: string; ok: boolean; hint: string }) {
  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
        {label}
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-money-500" : "bg-danger-500"}`} />
      </div>
      <div className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{value}</div>
      <div className="text-xs text-ink-400">{hint}</div>
    </div>
  );
}

interface AgentPerfRow {
  agentId: string;
  agentName: string;
  email?: string;
  companyName: string;
  leads: number;
  hot: number;
  warm: number;
  booked: number;
  pipeline: number;
  conversion: number;
}
interface CompanyRow {
  companyName: string;
  agents: number;
  leads: number;
  booked: number;
  pipeline: number;
}
interface Perf {
  agents: AgentPerfRow[];
  companies: CompanyRow[];
  totals: { agents?: number; leads?: number; booked?: number; pipeline?: number };
}

function usd(n: number) {
  return n ? compactUsd(n) : "—";
}

interface Sla {
  avgFirstResponseSec?: number;
  firstResponseBreachRate?: number;
  avgTimeToAssignHours?: number | null;
  unassignedHotCount?: number;
  unassignedHot?: { id: string; name: string; ageHours: number; breach: boolean }[];
  bookedUnassigned?: number;
  staleLeads?: number;
  thresholds?: { firstResponseBreachSec?: number; unassignedHotBreachHours?: number; staleHours?: number };
}

export default function PerformancePage() {
  const [perf, setPerf] = useState<Perf | null>(null);
  const [sla, setSla] = useState<Sla | null>(null);

  useEffect(() => {
    void fetch("/api/admin/performance", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { agents: [], companies: [], totals: {} }))
      .then(setPerf);
    void fetch("/api/admin/sla", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then(setSla);
  }, []);

  const t = perf?.totals ?? {};
  const stats = [
    { label: "Agents", value: t.agents ?? 0, icon: Users },
    { label: "Leads worked", value: t.leads ?? 0, icon: TrendingUp },
    { label: "Calls booked", value: t.booked ?? 0, icon: CalendarCheck },
    { label: "Pipeline value", value: usd(t.pipeline ?? 0), icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent Performance"
        description="How each agent and company is performing — leads worked, calls booked, conversion and pipeline value. Aggregates only; customer chats stay private."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
              <s.icon className="h-3.5 w-3.5 text-signal-500" /> {s.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-ink-900 dark:text-ink-100">{s.value}</div>
          </div>
        ))}
      </div>
      <p className="-mt-3 flex items-center gap-1.5 text-xs text-ink-400">
        <Info className="h-3.5 w-3.5" /> Pipeline values are rough estimates parsed from stated budgets, not signed deals.
      </p>

      {/* SLA / responsiveness */}
      {sla ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
            <Clock className="h-4 w-4 text-signal-500" /> Responsiveness &amp; SLAs
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SlaCard
              label="Avg AI first response"
              value={`${sla.avgFirstResponseSec ?? 0}s`}
              ok={(sla.avgFirstResponseSec ?? 0) <= (sla.thresholds?.firstResponseBreachSec ?? 15)}
              hint={`${Math.round((sla.firstResponseBreachRate ?? 0) * 100)}% over ${sla.thresholds?.firstResponseBreachSec ?? 15}s`}
            />
            <SlaCard
              label="Avg time to assign"
              value={sla.avgTimeToAssignHours == null ? "—" : `${sla.avgTimeToAssignHours}h`}
              ok={sla.avgTimeToAssignHours == null || sla.avgTimeToAssignHours <= 8}
              hint="lead created → agent owns it"
            />
            <SlaCard
              label="Unassigned hot leads"
              value={String(sla.unassignedHotCount ?? 0)}
              ok={(sla.unassignedHotCount ?? 0) === 0}
              hint={`breach > ${sla.thresholds?.unassignedHotBreachHours ?? 4}h old`}
            />
            <SlaCard
              label="Booked, no agent"
              value={String(sla.bookedUnassigned ?? 0)}
              ok={(sla.bookedUnassigned ?? 0) === 0}
              hint="calls nobody owns yet"
            />
          </div>
          {sla.unassignedHot && sla.unassignedHot.length > 0 ? (
            <div className="rounded-2xl border border-ink-200/80 bg-white p-3 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Hot leads waiting for an agent</div>
              <div className="flex flex-wrap gap-2">
                {sla.unassignedHot.map((l) => (
                  <span
                    key={l.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                      l.breach
                        ? "bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-500/15 dark:text-danger-300 dark:ring-danger-500/30"
                        : "bg-flare-50 text-flare-700 ring-flare-300 dark:bg-flare-500/15 dark:text-flare-300 dark:ring-flare-500/30"
                    }`}
                  >
                    {l.name} · {l.ageHours}h
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {perf === null ? (
        <TableSkeleton rows={5} cols={6} />
      ) : (
        <>
          {/* Per-agent leaderboard */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-100">By agent</h2>
            <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-100 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Agent</th>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold text-right">Leads</th>
                    <th className="px-4 py-3 font-semibold text-right">Hot</th>
                    <th className="px-4 py-3 font-semibold text-right">Booked</th>
                    <th className="px-4 py-3 font-semibold text-right">Conv.</th>
                    <th className="px-4 py-3 font-semibold text-right">Pipeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {perf.agents.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-400">No agent activity yet.</td></tr>
                  ) : (
                    perf.agents.map((a) => (
                      <tr key={a.agentId || a.agentName} className="hover:bg-paper-50 dark:hover:bg-ink-800/40">
                        <td className="px-4 py-3 font-medium text-ink-900 dark:text-ink-100">{a.agentName}</td>
                        <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{a.companyName || "—"}</td>
                        <td className="px-4 py-3 text-right num text-ink-700 dark:text-ink-300">{a.leads}</td>
                        <td className="px-4 py-3 text-right num text-danger-600 dark:text-danger-400">{a.hot || "—"}</td>
                        <td className="px-4 py-3 text-right num text-money-600 dark:text-money-400">{a.booked || "—"}</td>
                        <td className="px-4 py-3 text-right num text-ink-700 dark:text-ink-300">{Math.round(a.conversion * 100)}%</td>
                        <td className="px-4 py-3 text-right num text-ink-700 dark:text-ink-300">{usd(a.pipeline)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Per-company roll-up */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-100">By company</h2>
            <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-100 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold text-right">Agents</th>
                    <th className="px-4 py-3 font-semibold text-right">Leads</th>
                    <th className="px-4 py-3 font-semibold text-right">Booked</th>
                    <th className="px-4 py-3 font-semibold text-right">Pipeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {perf.companies.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">No company activity yet.</td></tr>
                  ) : (
                    perf.companies.map((c) => (
                      <tr key={c.companyName} className="hover:bg-paper-50 dark:hover:bg-ink-800/40">
                        <td className="px-4 py-3 font-medium text-ink-900 dark:text-ink-100">{c.companyName}</td>
                        <td className="px-4 py-3 text-right num text-ink-700 dark:text-ink-300">{c.agents}</td>
                        <td className="px-4 py-3 text-right num text-ink-700 dark:text-ink-300">{c.leads}</td>
                        <td className="px-4 py-3 text-right num text-money-600 dark:text-money-400">{c.booked || "—"}</td>
                        <td className="px-4 py-3 text-right num text-ink-700 dark:text-ink-300">{usd(c.pipeline)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

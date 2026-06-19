"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, Loader2, Sparkles, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { AgentChat } from "@/components/messaging/AgentChat";

interface Insight {
  wants: string;
  grade_rationale: string;
  suggested_next_step: string;
  questions_to_ask: string[];
  relevant_company_facts: string[];
  risk_flags: string[];
}

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
  reachedOutCount?: number;
}

const GRADE: Record<string, string> = {
  HOT: "bg-danger-50 text-danger-700 ring-danger-200 dark:bg-danger-500/15 dark:text-danger-300 dark:ring-danger-500/30",
  WARM: "bg-flare-50 text-flare-700 ring-flare-300 dark:bg-flare-500/15 dark:text-flare-300 dark:ring-flare-500/30",
  COLD: "bg-signal-50 text-signal-700 ring-signal-200 dark:bg-signal-500/15 dark:text-signal-300 dark:ring-signal-500/30",
};

const PROFILE_FIELDS: [string, string][] = [
  ["intent", "Looking to"],
  ["propertyType", "Property type"],
  ["location", "Location"],
  ["budget", "Budget"],
  ["timeline", "Timeline"],
  ["phone", "Phone"],
  ["notes", "Notes"],
];

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lead, setLead] = useState<Lead | null | undefined>(undefined);
  const [claiming, setClaiming] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [insighting, setInsighting] = useState(false);

  // Load a cached insight on open (never triggers the LLM).
  useEffect(() => {
    void fetch("/api/agent/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: id, cached_only: true }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.wants || d?.suggested_next_step) setInsight(d); });
  }, [id]);

  async function generateInsight(refresh = false) {
    setInsighting(true);
    const r = await fetch("/api/agent/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: id, refresh }),
    });
    setInsight(r.ok ? await r.json() : null);
    setInsighting(false);
  }

  const load = useCallback(async () => {
    const r = await fetch("/api/agent/leads", { cache: "no-store" });
    const list: Lead[] = r.ok ? await r.json() : [];
    setLead(list.find((l) => l.id === id) ?? null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function claim() {
    setClaiming(true);
    await fetch(`/api/agent/leads/${id}/assign`, { method: "POST" });
    await load();
    setClaiming(false);
  }

  return (
    <div className="space-y-5">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      {lead === undefined ? (
        <div className="py-16 text-center text-ink-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
      ) : lead === null ? (
        <p className="text-sm text-ink-400">Customer not found.</p>
      ) : (
        <>
          <PageHeader title={lead.name} description={lead.email || "Customer"} />

          <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
            {/* Profile rail */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${GRADE[lead.grade] || ""}`}>
                    {lead.grade} {lead.score || ""}
                  </span>
                  {lead.budgetEstimate ? <span className="num text-sm text-ink-600 dark:text-ink-300">${Math.round(lead.budgetEstimate / 1000)}k</span> : null}
                </div>
                {lead.bookedAt ? (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs text-money-600 dark:text-money-400">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Call booked {new Date(lead.bookedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                ) : null}
                <dl className="mt-3 space-y-1.5 text-sm">
                  {PROFILE_FIELDS.filter(([k]) => lead.profile?.[k]).map(([k, label]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-ink-400">{label}</dt>
                      <dd className="text-right text-ink-700 dark:text-ink-200">{lead.profile[k]}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Assignment */}
              <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
                {lead.assignedAgentId ? (
                  <div className="inline-flex items-center gap-1.5 text-sm text-ink-700 dark:text-ink-200">
                    <UserCheck className="h-4 w-4 text-money-500" /> Owned by {lead.assignedAgentName || "an agent"}
                  </div>
                ) : (
                  <button
                    onClick={claim}
                    disabled={claiming}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-signal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-signal-700 disabled:opacity-60"
                  >
                    {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null} I&apos;ll take this customer
                  </button>
                )}
              </div>

              {/* AI insight (on-demand, RAG-grounded) */}
              <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-800 dark:text-ink-100">
                    <Sparkles className="h-4 w-4 text-signal-500" /> AI insight
                  </span>
                  <button
                    onClick={() => generateInsight(Boolean(insight))}
                    disabled={insighting}
                    className="inline-flex items-center gap-1 rounded-lg bg-signal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-signal-700 disabled:opacity-50"
                  >
                    {insighting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {insight ? "Refresh" : "Generate"}
                  </button>
                </div>
                {insighting ? (
                  <p className="mt-2 text-xs text-ink-400">Reading the conversation with the local AI…</p>
                ) : insight ? (
                  <div className="mt-2 space-y-2 text-sm">
                    {insight.wants ? <p className="text-ink-700 dark:text-ink-200">{insight.wants}</p> : null}
                    {insight.suggested_next_step ? (
                      <p className="rounded-lg bg-signal-50 px-2.5 py-1.5 text-xs text-signal-800 dark:bg-signal-500/15 dark:text-signal-200">
                        <span className="font-semibold">Next:</span> {insight.suggested_next_step}
                      </p>
                    ) : null}
                    {insight.questions_to_ask?.length ? (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Ask</div>
                        <ul className="text-xs text-ink-600 dark:text-ink-300">
                          {insight.questions_to_ask.map((q, i) => <li key={i}>• {q}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {insight.relevant_company_facts?.length ? (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">From your knowledge base</div>
                        <ul className="text-xs text-ink-600 dark:text-ink-300">
                          {insight.relevant_company_facts.map((f, i) => <li key={i}>• {f}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {insight.risk_flags?.length ? (
                      <p className="text-xs text-danger-600 dark:text-danger-400">⚠ {insight.risk_flags.join(" · ")}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-400">Generate a quick brief: what they want, next step, questions to ask.</p>
                )}
              </div>
            </div>

            {/* Conversation */}
            <div className="rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <div className="border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-800 dark:border-ink-800 dark:text-ink-100">
                Message {lead.name.split(" ")[0]}
              </div>
              {lead.assignedAgentId ? (
                <AgentChat conversationId={lead.id} mode="agent" />
              ) : (
                <p className="p-6 text-sm text-ink-400">Claim this customer to start messaging them.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

interface Offer {
  id: string;
  title: string;
  offer: string;
  description: string;
  endsAt: string | null;
}

// Customer-facing card of the company's live offers, each with an "I'm interested"
// button that routes the customer to an agent (and pings staff to follow up).
export function ActiveOffers() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/campaigns/active", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => alive && setOffers(d.items || []))
      .catch(() => alive && setOffers([]));
    return () => {
      alive = false;
    };
  }, []);

  async function express(id: string) {
    setBusy(id);
    const r = await fetch(`/api/campaigns/${id}/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "" }),
    });
    setBusy(null);
    if (r.ok) setDone((prev) => ({ ...prev, [id]: true }));
  }

  if (!offers || offers.length === 0) return null; // nothing live → render nothing

  return (
    <div className="rounded-2xl border border-signal-200/70 bg-signal-50/60 p-4 dark:border-signal-500/20 dark:bg-signal-500/10">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-signal-700 dark:text-signal-300">
        <Sparkles className="h-4 w-4" /> Current offers for you
      </div>
      <div className="space-y-2.5">
        {offers.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-signal-200/60 bg-white px-3 py-2.5 dark:border-ink-700/70 dark:bg-ink-900">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                {o.title}{o.offer ? <span className="text-signal-600 dark:text-signal-400"> — {o.offer}</span> : null}
              </p>
              {o.description ? <p className="text-xs text-ink-500 dark:text-ink-400">{o.description}</p> : null}
              {o.endsAt ? <p className="text-[11px] text-ink-400">Ends {new Date(o.endsAt).toLocaleDateString()}</p> : null}
            </div>
            {done[o.id] ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-money-100 px-3 py-1.5 text-xs font-semibold text-money-700 dark:bg-money-500/15 dark:text-money-300">
                <Check className="h-3.5 w-3.5" /> An agent will reach out
              </span>
            ) : (
              <button
                onClick={() => express(o.id)}
                disabled={busy === o.id}
                className="inline-flex items-center gap-1 rounded-lg bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-signal-700 disabled:opacity-60"
              >
                {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} I'm interested
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

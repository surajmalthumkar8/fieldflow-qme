"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";

// The customer's standalone feedback: rate the AI (Elara) and the agent SEPARATELY,
// any time. Its own panel — never mixed into the chat.
export function CustomerFeedback({ businessId }: { businessId: string }) {
  const [hasAgent, setHasAgent] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [agentConvId, setAgentConvId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/messaging/my-thread", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setHasAgent(Boolean(d.hasAgent));
      setAgentId(d.thread?.agentId ?? "");
      setAgentConvId(d.conversationId ?? null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function submit(body: Record<string, unknown>) {
    return fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_id: businessId, source: "manual", ...body }),
    });
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card dark:border-ink-700 dark:bg-ink-900">
      <div className="text-sm font-semibold text-ink-800 dark:text-ink-100">Rate your experience</div>
      <p className="mt-0.5 text-xs text-ink-400">Your ratings help us improve. The AI and your agent are rated separately.</p>
      <div className="mt-4 space-y-3">
        <RatingRow
          label="How was Elara (your AI assistant)?"
          placeholder="What did Elara do well, or what could be better?"
          onSubmit={(rating, comment) => submit({ rating, comment, target: "ai", category: "ai_quality" })}
        />
        {hasAgent ? (
          <RatingRow
            label="How was your agent?"
            placeholder="How was your agent's help and responsiveness?"
            onSubmit={(rating, comment) =>
              submit({ rating, comment, target: "agent", agent_id: agentId, conversation_id: agentConvId ?? "", category: "agent" })
            }
          />
        ) : (
          <div className="rounded-lg border border-dashed border-ink-200 px-3 py-2 text-xs text-ink-400 dark:border-ink-700">
            You'll be able to rate your agent once one is assigned to you.
          </div>
        )}
      </div>
    </div>
  );
}

function RatingRow({
  label,
  placeholder,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  onSubmit: (rating: number, comment: string) => Promise<unknown>;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!rating) return;
    setBusy(true);
    await onSubmit(rating, comment.trim()).catch(() => {});
    setBusy(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-money-200 bg-money-50 px-3 py-2.5 text-xs text-money-700 dark:border-money-500/30 dark:bg-money-500/10 dark:text-money-300">
        <CheckCircle2 className="h-3.5 w-3.5" /> Thanks for your feedback!
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink-100 px-3 py-2.5 dark:border-ink-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-ink-600 dark:text-ink-300">{label}</span>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)} aria-label={`${n} stars`}>
              <Star className={`h-5 w-5 ${(hover || rating) >= n ? "fill-flare-400 text-flare-400" : "text-ink-300 dark:text-ink-600"}`} />
            </button>
          ))}
        </div>
      </div>
      {rating > 0 ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-signal-700 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Submit feedback"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

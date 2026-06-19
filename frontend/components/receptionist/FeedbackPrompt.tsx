"use client";

import { useState } from "react";
import { Star, CheckCircle2 } from "lucide-react";

// Lightweight post-booking feedback: a 1-5 rating + optional comment. Submitted to
// /api/feedback and surfaced to the company admin + platform feedback views.
export function FeedbackPrompt({
  businessId,
  conversationId,
}: {
  businessId: string;
  conversationId: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!rating) return;
    setBusy(true);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_id: businessId,
        conversation_id: conversationId,
        rating,
        comment: comment.trim(),
        source: "post_booking",
        category: comment ? "other" : "other",
      }),
    }).catch(() => {});
    setBusy(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-money-200 bg-money-50 p-3 text-sm text-money-700 dark:border-money-500/30 dark:bg-money-500/10 dark:text-money-300">
        <CheckCircle2 className="h-4 w-4" /> Thanks for the feedback!
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900">
      <div className="text-sm font-medium text-ink-800 dark:text-ink-100">How was your experience with Elara?</div>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="p-0.5"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              className={`h-6 w-6 transition ${
                (hover || rating) >= n ? "fill-flare-400 text-flare-400" : "text-ink-300 dark:text-ink-600"
              }`}
            />
          </button>
        ))}
      </div>
      {rating > 0 ? (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Anything we could improve? (optional)"
            className="mt-2 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-2 rounded-lg bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-signal-700 disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send feedback"}
          </button>
        </>
      ) : null}
    </div>
  );
}

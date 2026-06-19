"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send, Star } from "lucide-react";

interface Msg {
  id: string;
  sender: "agent" | "customer";
  kind: string;
  content: string;
  mine: boolean;
  createdAt: string | null;
}

// The agent↔customer human thread. `mode` decides the affordances:
//  - agent: can always send + a tap-to-send question library.
//  - customer: can reply only once their agent has started the thread, and can rate
//    the agent (needs businessId to file the feedback).
export function AgentChat({
  conversationId,
  mode,
  businessId = "",
  enableRating = false,
}: {
  conversationId: string;
  mode: "agent" | "customer";
  businessId?: string;
  enableRating?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [hasThread, setHasThread] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [rating, setRating] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [rated, setRated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/messaging/thread/${conversationId}`, { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setMessages(d.messages ?? []);
      setHasThread(Boolean(d.thread));
      setAgentId(d.thread?.agentId ?? "");
    }
    setLoading(false);
  }, [conversationId]);

  async function rateAgent(stars: number) {
    setRating(stars);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_id: businessId,
        conversation_id: conversationId,
        rating: stars,
        target: "agent",
        agent_id: agentId,
        category: "agent",
        source: "manual",
      }),
    }).catch(() => {});
    setRated(true);
  }

  useEffect(() => {
    void load();
    const id = setInterval(load, 5000); // light polling
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (mode === "agent") {
      void fetch("/api/messaging/question-library", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { questions: [] }))
        .then((d) => setQuestions(d.questions ?? []));
    }
  }, [mode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(content: string, kind: "text" | "question" = "text") {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    const r = await fetch(`/api/messaging/thread/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, kind }),
    });
    setSending(false);
    if (r.ok) {
      setDraft("");
      await load();
    }
  }

  const canType = mode === "agent" || hasThread;

  return (
    <div className="flex h-[460px] flex-col">
      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {loading ? (
          <div className="py-8 text-center text-ink-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">
            {mode === "agent"
              ? "No messages yet — say hello or send a question below."
              : "Your agent hasn't messaged you yet. They'll reach out here."}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.mine
                    ? "bg-signal-600 text-white"
                    : "bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-100"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Question library (agents) */}
      {mode === "agent" && questions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-ink-100 px-3 py-2 dark:border-ink-800">
          {questions.slice(0, 6).map((q) => (
            <button
              key={q}
              onClick={() => send(q, "question")}
              disabled={sending}
              className="rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-600 transition hover:border-signal-300 hover:bg-signal-50 hover:text-signal-700 disabled:opacity-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}

      {/* Composer */}
      <div className="flex items-center gap-2 border-t border-ink-100 p-3 dark:border-ink-800">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(draft)}
          disabled={!canType || sending}
          placeholder={canType ? "Type a message…" : "Waiting for your agent…"}
          className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none disabled:opacity-60 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
        />
        <button
          onClick={() => send(draft)}
          disabled={!canType || sending || !draft.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-signal-600 px-3 py-2 text-white hover:bg-signal-700 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      {/* Rate your agent (optional inline; the customer panel owns the main feedback) */}
      {enableRating && mode === "customer" && hasThread ? (
        <div className="flex items-center gap-2 border-t border-ink-100 px-3 py-2 dark:border-ink-800">
          {rated ? (
            <span className="inline-flex items-center gap-1 text-xs text-money-600 dark:text-money-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Thanks for rating your agent!
            </span>
          ) : (
            <>
              <span className="text-xs text-ink-500 dark:text-ink-400">Rate your agent:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onMouseEnter={() => setRatingHover(n)}
                  onMouseLeave={() => setRatingHover(0)}
                  onClick={() => rateAgent(n)}
                  aria-label={`${n} stars`}
                >
                  <Star className={`h-4 w-4 ${(ratingHover || rating) >= n ? "fill-flare-400 text-flare-400" : "text-ink-300 dark:text-ink-600"}`} />
                </button>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, CalendarCheck2, RotateCcw, Radio, AlertTriangle } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { usd } from "@/lib/format";

interface Turn {
  role: "user" | "assistant";
  content: string;
}
interface BookingInfo {
  service: string;
  estimatedValue: number;
  isHighTicket: boolean;
}

const SUGGESTIONS = [
  "Yeah, our AC has been struggling lately",
  "How much for a tune-up?",
  "STOP",
];

export function SmsQualifierChat({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [engine, setEngine] = useState<"live" | "demo" | null>(null);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [optedOut, setOptedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending || optedOut) return;
    const history = turns;
    setTurns((t) => [...t, { role: "user", content: msg }]);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, history, userMessage: msg }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        conversationId?: string;
        reply?: string;
        engine?: "live" | "demo";
        booking?: BookingInfo | null;
        action?: { type: string };
        error?: string;
      };
      if (data.ok) {
        setConversationId(data.conversationId ?? null);
        setEngine(data.engine ?? null);
        setTurns((t) => [...t, { role: "assistant", content: data.reply ?? "" }]);
        if (data.booking) setBooking(data.booking);
        if (data.action?.type === "opt_out") setOptedOut(true);
        router.refresh();
      } else {
        // Roll back the optimistic user bubble and let them retry.
        setTurns(history);
        setInput(msg);
        setError(data.error ?? "The AI couldn't respond. Try again.");
      }
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch {
      setTurns(history);
      setInput(msg);
      setError("Network error — couldn't reach the server. Try again.");
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setTurns([]);
    setConversationId(null);
    setBooking(null);
    setOptedOut(false);
    setEngine(null);
    setError(null);
  }

  return (
    <Card>
      <CardHeader
        title="Test the SMS qualifier"
        subtitle="Text as the customer — the AI replies as the business, qualifies, and books. STOP works too."
        action={
          <div className="flex items-center gap-2">
            {engine ? (
              <Badge tone={engine === "live" ? "money" : "neutral"}>
                <Radio className="h-3 w-3" />
                {engine === "live" ? "Live Claude" : "Demo brain"}
              </Badge>
            ) : null}
            <Button variant="ghost" onClick={reset} type="button" className="px-2 py-1">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-3">
        {/* Phone-style thread */}
        <div
          ref={scrollRef}
          className="h-72 space-y-2 overflow-y-auto rounded-2xl border border-ink-200/70 bg-ink-50/50 p-4 scroll-thin"
        >
          {turns.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-ink-400">
              <p className="font-medium text-ink-500">{businessName} · SMS</p>
              <p className="mt-1 max-w-xs">
                Type a reply as a past customer below — try &ldquo;our AC quit&rdquo; or &ldquo;STOP&rdquo;.
              </p>
            </div>
          ) : (
            turns.map((t, i) => (
              <div
                key={i}
                className={t.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    t.role === "user"
                      ? "max-w-[78%] rounded-2xl rounded-br-sm bg-signal-600 px-3.5 py-2 text-sm text-white shadow-sm"
                      : "max-w-[78%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-sm text-ink-800 ring-1 ring-ink-200"
                  }
                >
                  {t.content}
                </div>
              </div>
            ))
          )}
          {sending ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-sm text-ink-400 ring-1 ring-ink-200">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          ) : null}
        </div>

        {booking ? (
          <div className="flex items-center gap-2 rounded-xl bg-money-50 px-3 py-2 text-xs text-money-700 ring-1 ring-inset ring-money-400/40">
            <CalendarCheck2 className="h-4 w-4" />
            Booked: {booking.service} · est. <span className="num">{usd(booking.estimatedValue)}</span>
            {booking.isHighTicket ? <Badge tone="money">High-ticket</Badge> : null}
          </div>
        ) : null}
        {optedOut ? (
          <div className="rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700 ring-1 ring-inset ring-danger-400/40">
            Customer opted out (STOP). Lead is suppressed — no further messages would be sent.
          </div>
        ) : null}
        {error ? (
          <div className="flex items-center gap-2 rounded-xl bg-danger-50 px-3 py-2 text-xs font-medium text-danger-700 ring-1 ring-inset ring-danger-400/40">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {/* Quick suggestions */}
        {turns.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs text-ink-600 hover:border-signal-300 hover:text-signal-700"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={optedOut}
            placeholder={optedOut ? "Conversation ended (opted out)" : "Reply as the customer…"}
            className="flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-400/40 disabled:bg-ink-50"
          />
          <Button type="submit" disabled={sending || !input.trim() || optedOut}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

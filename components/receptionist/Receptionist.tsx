"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { CallPanel } from "./CallPanel";
import { Transcript } from "./Transcript";
import { BookingCard } from "./BookingCard";
import { useSpeech } from "./useSpeech";
import type {
  BookingInfo,
  CallStatus,
  Scenario,
  TranscriptTurn,
  VoiceApiResponse,
} from "./types";

const HINT = 'Try: "My AC stopped cooling, can someone come tomorrow at 9am?"';

export function Receptionist({
  businessId,
  businessName,
  tradeLabel,
  serviceArea,
  engineLive,
  scenarios,
}: {
  businessId: string;
  businessName: string;
  tradeLabel: string;
  serviceArea?: string;
  engineLive: boolean;
  scenarios: Scenario[];
}) {
  const speech = useSpeech();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [status, setStatus] = useState<CallStatus>("idle");
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [engine, setEngine] = useState<"live" | "demo">(engineLive ? "live" : "demo");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep history in a ref so we can read the latest synchronously inside send().
  const historyRef = useRef<TranscriptTurn[]>([]);
  const startedRef = useRef(false);

  const send = useCallback(
    async (userMessage: string, isStart: boolean) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      const trimmed = userMessage.trim();

      if (!isStart && trimmed) {
        const userTurn: TranscriptTurn = { role: "user", content: trimmed };
        setTurns((t) => [...t, userTurn]);
        historyRef.current = [...historyRef.current, userTurn];
      }

      setStatus("thinking");
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            conversationId,
            history: isStart ? [] : historyRef.current.slice(0, -1),
            userMessage: isStart ? "" : trimmed,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Request failed (${res.status})`);
        }
        const data = (await res.json()) as VoiceApiResponse;
        setConversationId(data.conversationId);
        setEngine(data.engine);

        const assistantTurn: TranscriptTurn = { role: "assistant", content: data.reply };
        setTurns((t) => [...t, assistantTurn]);
        historyRef.current = [...historyRef.current, assistantTurn];

        if (data.booking) setBooking(data.booking);

        // Speak the reply (no-op if synth unsupported).
        setStatus("speaking");
        speech.speak(data.reply);
        // Return to idle shortly after; speechSynthesis has no reliable end
        // event across browsers, so we settle the indicator on a short timer.
        window.setTimeout(() => setStatus("idle"), 600);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setStatus("idle");
      } finally {
        setBusy(false);
      }
    },
    [busy, businessId, conversationId, speech]
  );

  // Auto-start the call on mount: fetch + display (+ speak) the greeting.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void send("", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    void send(text, false);
  };

  // Press-to-talk: start STT; on release, the final transcript is sent.
  const onMicDown = useCallback(() => {
    if (busy) return;
    speech.cancelSpeak();
    setStatus("listening");
    speech.startListening((transcript) => {
      void send(transcript, false);
    });
  }, [busy, speech, send]);

  const onMicUp = useCallback(() => {
    speech.stopListening();
    if (status === "listening") setStatus("idle");
  }, [speech, status]);

  const newCall = useCallback(() => {
    speech.cancelSpeak();
    speech.stopListening();
    historyRef.current = [];
    startedRef.current = false;
    setTurns([]);
    setConversationId(undefined);
    setBooking(null);
    setError(null);
    setStatus("idle");
    setDraft("");
    // Re-arm the greeting.
    startedRef.current = true;
    void send("", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech]);

  return (
    <div className="space-y-4">
      {/* Toolbar: engine badge + new call */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={engine === "live" ? "money" : "neutral"}>
          <Sparkles className="h-3 w-3" />
          {engine === "live" ? "Live Claude Haiku" : "Demo brain (no key)"}
        </Badge>
        <Button variant="secondary" onClick={newCall} disabled={busy}>
          <RotateCcw className="h-4 w-4" />
          New call
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: call panel */}
        <div className="lg:col-span-1">
          <CallPanel
            businessName={businessName}
            tradeLabel={tradeLabel}
            serviceArea={serviceArea}
            status={status}
            micSupported={speech.recognitionSupported}
            listening={speech.listening}
            onMicDown={onMicDown}
            onMicUp={onMicUp}
          />
        </div>

        {/* Right: transcript + composer */}
        <div className="lg:col-span-2">
          <Card className="flex h-[34rem] flex-col">
            <CardHeader
              title="Live transcript"
              subtitle="Everything the AI hears and says — persisted to Conversations."
              action={
                speech.synthSupported ? null : (
                  <span className="text-[11px] text-ink-400">
                    (audio playback off — this browser)
                  </span>
                )
              }
            />
            <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-ink-100">
              <Transcript turns={turns} thinking={status === "thinking"} />

              {/* Composer */}
              <div className="border-t border-ink-100 p-3">
                {error ? (
                  <p className="mb-2 rounded-lg bg-danger-50 px-3 py-1.5 text-xs text-danger-700">
                    {error}
                  </p>
                ) : null}

                {/* Quick scenarios */}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {scenarios.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setDraft(s.text)}
                      disabled={busy}
                      className={cn(
                        "rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-600 transition-colors hover:border-signal-300 hover:bg-signal-50 hover:text-signal-700 disabled:opacity-50"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit} className="flex items-end gap-2">
                  <label htmlFor="qme-msg" className="sr-only">
                    Message the receptionist
                  </label>
                  <input
                    id="qme-msg"
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={HINT}
                    autoComplete="off"
                    disabled={busy}
                    className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-100 disabled:opacity-50"
                  />
                  <Button type="submit" disabled={busy || !draft.trim()}>
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </form>
              </div>
            </div>
          </Card>

          {booking ? (
            <div className="mt-4">
              <BookingCard booking={booking} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { PERSONA_NAME } from "@/lib/persona";
import { CallPanel } from "./CallPanel";
import { Transcript } from "./Transcript";
import { SlotPicker } from "./SlotPicker";
import { useSpeech } from "./useSpeech";
import type { CallStatus, Scenario, TranscriptTurn } from "./types";

const HINT = `Try: "I'm looking to buy a 3-bed home in Austin, around $650k"`;

interface ChatApiResponse {
  reply: string;
  qualified?: boolean;
  sentiment?: string;
  action?: { type?: string; notes?: string | null };
  captured?: Record<string, string>;
  engine?: string;
  conversation_id?: string | null;
}

export function Receptionist({
  businessId,
  businessName,
  tradeLabel,
  serviceArea,
  scenarios,
  customerName = "",
  customerEmail = "",
}: {
  businessId: string;
  businessName: string;
  tradeLabel: string;
  serviceArea?: string;
  scenarios: Scenario[];
  customerName?: string;
  customerEmail?: string;
}) {
  const speech = useSpeech();
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [voiceOn, setVoiceOn] = useState(true);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [captured, setCaptured] = useState<Record<string, string>>({});

  // Keep history in a ref so we can read the latest synchronously inside send().
  const historyRef = useRef<TranscriptTurn[]>([]);
  const conversationIdRef = useRef<string | null>(null); // persisted conversation thread
  const startedRef = useRef(false);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

  const send = useCallback(
    async (userMessage: string, isStart: boolean) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      if (!isStart) setShowScheduler(false); // clear any prior inline scheduler
      const trimmed = userMessage.trim();

      if (!isStart && trimmed) {
        const userTurn: TranscriptTurn = { role: "user", content: trimmed };
        setTurns((t) => [...t, userTurn]);
        historyRef.current = [...historyRef.current, userTurn];
      }

      setStatus("thinking");
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            businessName,
            serviceArea,
            conversationId: conversationIdRef.current,
            history: isStart ? [] : historyRef.current.slice(0, -1),
            message: isStart ? "" : trimmed,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `Request failed (${res.status})`);
        }
        const data = (await res.json()) as ChatApiResponse;
        if (data.conversation_id) conversationIdRef.current = data.conversation_id;
        const assistantTurn: TranscriptTurn = { role: "assistant", content: data.reply };

        // Accumulate captured contact details across turns; open the slot picker
        // when Elara decides to schedule a call.
        if (data.captured && Object.keys(data.captured).length) {
          setCaptured((c) => ({ ...c, ...data.captured }));
        }
        // Open the slot picker when Elara decides to schedule OR the visitor
        // clearly asked to (a 3B model doesn't always set the action reliably).
        const askedToSchedule =
          /\b(schedul\w*|book|set\s?up|arrange)\b/i.test(trimmed) &&
          /\b(call|meeting|appointment|agent|visit|time|slot)\b/i.test(trimmed);
        if (data.action?.type === "schedule" || askedToSchedule) setShowScheduler(true);

        // Reveal the transcript line + commit it to history exactly once.
        let revealed = false;
        const reveal = () => {
          if (revealed) return;
          revealed = true;
          setTurns((t) => [...t, assistantTurn]);
          historyRef.current = [...historyRef.current, assistantTurn];
        };

        if (voiceOnRef.current) {
          // Sync: show the text the moment the voice starts (not seconds before).
          setStatus("speaking");
          const safety = window.setTimeout(reveal, 4000); // never strand the text
          await speech.speak(data.reply, () => {
            window.clearTimeout(safety);
            reveal();
          });
          setStatus("idle");
        } else {
          reveal();
          setStatus("idle");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setStatus("idle");
      } finally {
        setBusy(false);
      }
    },
    [busy, businessId, businessName, serviceArea, speech]
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

  // Tap-to-talk toggle: tap to start (keeps listening through pauses), tap again
  // to stop — then the full transcript is sent. No half-sentences from a pause.
  const onMicToggle = useCallback(() => {
    if (speech.listening) {
      speech.stopListening();
      setStatus("idle");
      return;
    }
    if (busy) return;
    speech.cancelSpeak();
    setStatus("listening");
    speech.startListening((transcript) => {
      void send(transcript, false);
    });
  }, [busy, speech, send]);

  const newCall = useCallback(() => {
    speech.cancelSpeak();
    speech.stopListening();
    historyRef.current = [];
    conversationIdRef.current = null;
    setTurns([]);
    setError(null);
    setStatus("idle");
    setDraft("");
    setShowScheduler(false);
    setCaptured({});
    startedRef.current = true;
    void send("", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech]);

  return (
    <div className="space-y-4">
      {/* Toolbar: engine badge + voice toggle + new call */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="money">
          <Sparkles className="h-3 w-3" />
          {PERSONA_NAME} · local AI
        </Badge>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setVoiceOn((v) => !v)}>
            {voiceOn ? "🔊 Voice on" : "🔇 Voice off"}
          </Button>
          <Button variant="secondary" onClick={newCall} disabled={busy}>
            <RotateCcw className="h-4 w-4" />
            New call
          </Button>
        </div>
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
            onMicToggle={onMicToggle}
          />
        </div>

        {/* Right: transcript + composer */}
        <div className="lg:col-span-2">
          <Card className="flex h-[34rem] flex-col">
            <CardHeader
              title="Live transcript"
              subtitle={`Everything you say and ${PERSONA_NAME} says.`}
            />
            <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-ink-100 dark:border-ink-800">
              <Transcript
                turns={turns}
                thinking={status === "thinking"}
                footer={
                  showScheduler ? (
                    <SlotPicker
                      businessId={businessId}
                      businessName={businessName}
                      defaultName={captured.name || customerName}
                      defaultEmail={captured.email || customerEmail}
                      defaultPhone={captured.phone || ""}
                      onBooked={(label, emailed) => {
                        // Keep the picker in its booked state (download stays); it
                        // clears when the visitor sends their next message.
                        const confirm: TranscriptTurn = {
                          role: "assistant",
                          content: emailed
                            ? `You're all set for ${label} — I've emailed the calendar invite. An agent will call you then.`
                            : `You're all set for ${label}. An agent will call you then — you can add it to your calendar from the invite above.`,
                        };
                        setTurns((t) => [...t, confirm]);
                        historyRef.current = [...historyRef.current, confirm];
                        if (voiceOnRef.current) void speech.speak(confirm.content);
                      }}
                    />
                  ) : null
                }
              />

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
        </div>
      </div>
    </div>
  );
}

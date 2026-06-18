"use client";

import { useEffect, useRef, useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { PERSONA_NAME } from "@/lib/persona";

type Turn = { role: "user" | "assistant"; content: string };

type Lead = {
  leadGrade: "HOT" | "WARM" | "COLD";
  leadScore: number;
  intentScore: number;
  budgetEstimate: number;
  opportunitySize: number;
  sentiment: string;
  rationale: string;
  captured: Record<string, string>;
};

const BUSINESS = { id: "re-demo", name: "Lone Star Realty", area: "Austin, TX metro" };

const GRADE_STYLES: Record<string, string> = {
  HOT: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  WARM: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  COLD: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
};

function usd(n: number) {
  if (!n) return "—";
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

export default function AiReceptionistPage() {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // Chat is silent by default — voice is opt-in (turn it on, or use Talk mode).
  const [voiceOn, setVoiceOn] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [provider, setProvider] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void send("", []); // opening greeting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function speak(text: string) {
    if (!voiceOn || !text) return;
    try {
      const res = await fetch("/api/ai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      setProvider(res.headers.get("X-TTS-Provider") || "");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => setSpeaking(false);
      await audio.play().catch(() => setSpeaking(false));
    } catch {
      setSpeaking(false);
    }
  }

  async function refreshLead(history: Turn[]) {
    const userTurns = history.filter((t) => t.role === "user");
    if (!userTurns.length) return;
    try {
      const res = await fetch("/api/ai/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history }),
      });
      if (res.ok) setLead(await res.json());
    } catch {
      /* ignore */
    }
  }

  async function send(message: string, history: Turn[]) {
    setBusy(true);
    const nextHistory = message
      ? [...history, { role: "user" as const, content: message }]
      : history;
    if (message) setMessages(nextHistory);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: BUSINESS.id,
          businessName: BUSINESS.name,
          serviceArea: BUSINESS.area,
          history,
          message,
        }),
      });
      const data = await res.json();
      const reply: string = data.reply || "Sorry, could you say that again?";
      const updated = [...nextHistory, { role: "assistant" as const, content: reply }];
      setMessages(updated);
      void speak(reply);
      void refreshLead(updated);
    } catch {
      setMessages([
        ...nextHistory,
        { role: "assistant", content: "I'm having trouble connecting right now — please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void send(text, messages);
  }

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr]">
      {/* Conversation */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03]">
        <header className="flex items-center gap-4 border-b border-white/10 p-5">
          <AgentAvatar speaking={speaking} size={64} />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-slate-100">{PERSONA_NAME} · AI Receptionist</h1>
            <p className="text-sm text-slate-400">
              {BUSINESS.name} — {BUSINESS.area} · powered by local Ollama
            </p>
          </div>
          <button
            onClick={() => setVoiceOn((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-sm ring-1 transition ${
              voiceOn ? "bg-indigo-500/20 text-indigo-200 ring-indigo-400/40" : "bg-white/5 text-slate-400 ring-white/10"
            }`}
            title={`Toggle ${PERSONA_NAME}'s voice`}
          >
            {voiceOn ? "🔊 Voice on" : "🔇 Voice off"}
          </button>
        </header>

        <div ref={scrollRef} className="h-[52vh] space-y-3 overflow-y-auto p-5">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-indigo-500 text-white"
                    : "bg-white/[0.06] text-slate-200 ring-1 ring-white/10"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-slate-400 ring-1 ring-white/10">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.3s]" />
                </span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 border-t border-white/10 p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Try: I'm looking to buy a 3-bed home in Austin, around $650k…"
            autoComplete="off"
            suppressHydrationWarning
            className="flex-1 rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            Send
          </button>
        </form>
        {provider && (
          <p className="px-4 pb-3 text-xs text-slate-500">
            voice: {provider === "kokoro" ? "Kokoro (local neural TTS)" : provider}
          </p>
        )}
      </section>

      {/* Live lead intelligence */}
      <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Live lead analysis
        </h2>
        <p className="mt-1 text-xs text-slate-500">Scored in real time by the local AI as you talk.</p>

        {!lead ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            Start chatting — the lead grade, scores and captured details appear here.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${GRADE_STYLES[lead.leadGrade] || ""}`}
              >
                {lead.leadGrade} LEAD
              </span>
              <span className="text-xs capitalize text-slate-400">sentiment: {lead.sentiment}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Lead score" value={`${lead.leadScore}/100`} />
              <Stat label="Intent" value={`${lead.intentScore}/100`} />
              <Stat label="Budget est." value={usd(lead.budgetEstimate)} />
              <Stat label="Opportunity" value={usd(lead.opportunitySize)} accent />
            </div>

            {lead.rationale && (
              <p className="rounded-lg bg-white/[0.04] p-3 text-xs text-slate-300">{lead.rationale}</p>
            )}

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Captured</h3>
              <dl className="mt-2 space-y-1">
                {Object.entries(lead.captured)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 text-sm">
                      <dt className="capitalize text-slate-500">{k}</dt>
                      <dd className="text-right text-slate-200">{v}</dd>
                    </div>
                  ))}
                {!Object.values(lead.captured).some(Boolean) && (
                  <p className="text-sm text-slate-500">Nothing captured yet.</p>
                )}
              </dl>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${accent ? "text-emerald-300" : "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

interface ConvSummary {
  id: string;
  title: string;
  lead_name: string;
  updated_at: string | null;
  preview: string;
  message_count: number;
}
interface Transcript {
  id: string;
  title: string;
  messages: { role: string; content: string }[];
}

function relTime(iso?: string | null) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function ConversationsPage() {
  const [list, setList] = useState<ConvSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loadingT, setLoadingT] = useState(false);

  useEffect(() => {
    void fetch("/api/agent/conversations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: ConvSummary[]) => {
        setList(d);
        if (d.length) setSelected(d[0].id);
      });
  }, []);

  const loadTranscript = useCallback(async (id: string) => {
    setLoadingT(true);
    const r = await fetch(`/api/ai/conversations/${id}`, { cache: "no-store" });
    setTranscript(r.ok ? await r.json() : null);
    setLoadingT(false);
  }, []);

  useEffect(() => {
    if (selected) void loadTranscript(selected);
  }, [selected, loadTranscript]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conversations"
        description="Every AI receptionist session for your company — read the full transcript of what Elara and the customer said."
      />

      {list === null ? (
        <div className="py-16 text-center text-ink-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-ink-200/80 bg-white p-10 text-center shadow-card dark:border-ink-700/70 dark:bg-ink-900">
          <MessagesSquare className="mx-auto h-8 w-8 text-ink-300" />
          <p className="mt-2 text-sm text-ink-400">No conversations yet — they appear here when customers chat with your AI receptionist.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <div className="max-h-[70vh] space-y-1.5 overflow-y-auto">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  selected === c.id
                    ? "border-signal-300 bg-signal-50 dark:border-signal-500/40 dark:bg-signal-500/10"
                    : "border-ink-200/80 bg-white hover:border-ink-300 dark:border-ink-700/70 dark:bg-ink-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{c.lead_name || c.title || "Visitor"}</span>
                  <span className="shrink-0 text-[11px] text-ink-400">{relTime(c.updated_at)}</span>
                </div>
                <div className="truncate text-xs text-ink-500 dark:text-ink-400">{c.preview || "—"}</div>
                <div className="mt-0.5 text-[11px] text-ink-400">{c.message_count} messages</div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
            {loadingT ? (
              <div className="py-16 text-center text-ink-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
            ) : transcript ? (
              <div className="flex h-[70vh] flex-col">
                <div className="border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-800 dark:border-ink-800 dark:text-ink-100">
                  {transcript.title || "Conversation"}
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {transcript.messages.length === 0 ? (
                    <p className="text-sm text-ink-400">No messages.</p>
                  ) : (
                    transcript.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          m.role === "assistant"
                            ? "bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-100"
                            : "bg-signal-600 text-white"
                        }`}>
                          <div className="mb-0.5 flex items-center gap-1 text-[10px] uppercase opacity-70">
                            {m.role === "assistant" ? "Elara" : "Customer"}
                          </div>
                          {m.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-ink-400">Select a conversation to read the transcript.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, FileText, Globe, Loader2, Plug, Plus, Webhook } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

interface Doc { id: string; title: string; source: string }

export default function KnowledgePage() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/kb", { cache: "no-store" });
    setDocs(r.ok ? await r.json() : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!content.trim()) return setMsg("Add some text to train on.");
    setBusy(true);
    const r = await fetch("/api/admin/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(data.error || "Could not add");
    setTitle("");
    setContent("");
    setMsg(`Added — ${data.chunks} chunks embedded. The AI can now use this.`);
    await load();
  }

  const input = "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Train the AI"
        description="Add your company's knowledge — listings info, FAQs, policies, neighborhoods. Elara grounds her answers in this (RAG). Ingestion is billed by data size."
      />

      {msg ? (
        <p className="rounded-lg bg-money-50 px-3 py-2 text-sm text-money-700 dark:bg-money-500/15 dark:text-money-300">{msg}</p>
      ) : null}

      {/* Manual upload */}
      <form onSubmit={add} className="space-y-3 rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
          <FileText className="h-4 w-4 text-signal-500" /> Add knowledge (manual)
        </div>
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title — e.g. Downtown Austin neighborhoods" />
        <textarea className={input} rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste FAQs, listing details, policies, anything the AI should know…" />
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-signal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-signal-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add &amp; train
        </button>
      </form>

      {/* Existing docs */}
      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-800 dark:border-ink-800 dark:text-ink-100">
          <BookOpen className="h-4 w-4 text-signal-500" /> Knowledge base
        </div>
        {docs === null ? (
          <div className="py-8 text-center text-ink-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : docs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-400">Nothing yet — add your first knowledge above.</p>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-ink-800 dark:text-ink-100">{d.title}</span>
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500 dark:bg-ink-800 dark:text-ink-400">{d.source}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Connectors (scaffold) */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
          <Plug className="h-4 w-4 text-signal-500" /> Auto-sync connectors
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
            <div className="flex items-center gap-2 text-sm font-medium text-ink-700 dark:text-ink-200">
              <Globe className="h-4 w-4 text-signal-500" /> Atlassian / Confluence
            </div>
            <p className="mt-1 text-xs text-ink-400">Connect a Confluence space — we list pages, fetch them, hash for changes and re-embed only what changed. Billed per MB.</p>
            <span className="mt-2 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500 dark:bg-ink-800 dark:text-ink-400">Coming soon</span>
          </div>
          <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
            <div className="flex items-center gap-2 text-sm font-medium text-ink-700 dark:text-ink-200">
              <Webhook className="h-4 w-4 text-signal-500" /> API / Webhook
            </div>
            <p className="mt-1 text-xs text-ink-400">Stream data to us programmatically — we batch-process and load it into the AI's knowledge. Billed per MB.</p>
            <span className="mt-2 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500 dark:bg-ink-800 dark:text-ink-400">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, MessageSquarePlus, Send, Trash2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

interface Agent {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  business_id: string | null;
}
interface QTemplate { id: string; text: string }

function QuestionTemplates() {
  const [list, setList] = useState<QTemplate[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/question-templates", { cache: "no-store" });
    setList(r.ok ? await r.json() : []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    await fetch("/api/admin/question-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    setText(""); setBusy(false); await load();
  }
  async function remove(id: string) {
    await fetch(`/api/admin/question-templates/${id}`, { method: "DELETE" });
    await load();
  }
  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
        <MessageSquarePlus className="h-4 w-4 text-signal-500" /> Quick questions for agents
      </div>
      <p className="mt-0.5 text-xs text-ink-400">Custom tap-to-send questions your agents can fire off in chat — on top of the built-in ones.</p>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Are you open to nearby suburbs?" className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100" />
        <button type="submit" disabled={busy} className="rounded-lg bg-signal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-signal-700 disabled:opacity-60">Add</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {list === null ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : list.length === 0 ? (
          <span className="text-xs text-ink-400">No custom questions yet.</span>
        ) : list.map((q) => (
          <span key={q.id} className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-xs text-ink-700 dark:bg-ink-800 dark:text-ink-200">
            {q.text}
            <button onClick={() => remove(q.id)} className="text-ink-400 hover:text-danger-600">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function MyAgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const a = await fetch("/api/admin/agents", { cache: "no-store" });
    setAgents(a.ok ? await a.json() : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setNotice("");
    if (!email.trim()) return setErr("Enter the agent's email.");
    setBusy(true);
    // No password — the backend creates the agent in YOUR company and emails them
    // a secure link to set their own password.
    const r = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: name }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(data.error || "Could not invite agent");
    setName("");
    setEmail("");
    setNotice(
      data.emailed
        ? `Invite emailed to ${data.email}. They'll set their own password and can sign in.`
        : `Agent created. Email isn't configured — share this link: ${data.reset_link ?? "(see server)"}`
    );
    await load();
  }

  async function resend(id: string) {
    setResending(id);
    setErr("");
    setNotice("");
    const r = await fetch(`/api/admin/invite/${id}/resend`, { method: "POST" });
    const data = await r.json().catch(() => ({}));
    setResending(null);
    if (!r.ok) return setErr(data.error || "Could not resend");
    setNotice(data.emailed ? "Invite re-sent." : `Share this link: ${data.reset_link ?? "(see server)"}`);
  }

  async function remove(id: string, who: string) {
    if (!confirm(`Remove agent ${who}?`)) return;
    setErr("");
    const r = await fetch(`/api/admin/agents/${id}`, { method: "DELETE" });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error || "Could not remove agent");
    await load();
  }

  const input =
    "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100";

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Agents"
        description="Invite the agents who work your company's customers. They get a secure email link to set their own password — no shared passwords."
      />

      {err ? (
        <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:bg-danger-500/15 dark:text-danger-300">{err}</p>
      ) : null}
      {notice ? (
        <p className="rounded-lg bg-money-50 px-3 py-2 text-sm text-money-700 dark:bg-money-500/15 dark:text-money-300">{notice}</p>
      ) : null}

      <form
        onSubmit={invite}
        className="grid gap-2 rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card sm:grid-cols-[1fr_1fr_auto] sm:items-end dark:border-ink-700/70 dark:bg-ink-900"
      >
        <label className="text-xs text-ink-500 dark:text-ink-400">
          Full name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Agent" />
        </label>
        <label className="text-xs text-ink-500 dark:text-ink-400">
          Agent email
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-signal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-signal-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Send invite
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Agent</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {agents === null ? (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-ink-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : agents.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-ink-400">No agents yet — invite one above.</td></tr>
            ) : (
              agents.map((a) => (
                <tr key={a.id} className="hover:bg-paper-50 dark:hover:bg-ink-800/40">
                  <td className="px-4 py-3 font-medium text-ink-900 dark:text-ink-100">{a.full_name || "—"}</td>
                  <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{a.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => resend(a.id)}
                        disabled={resending === a.id}
                        className="inline-flex items-center gap-1 text-xs font-medium text-signal-600 hover:text-signal-700 disabled:opacity-50 dark:text-signal-400"
                        title="Resend set-password link"
                      >
                        {resending === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Resend invite
                      </button>
                      <button onClick={() => remove(a.id, a.email)} className="text-ink-400 transition hover:text-danger-600" title="Remove agent">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink-400">
        <Mail className="h-3.5 w-3.5" /> Invites use a secure, single-use link that expires in 48 hours.
      </p>

      <QuestionTemplates />
    </div>
  );
}

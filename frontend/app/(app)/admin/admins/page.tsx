"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Send, Trash2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

interface Company {
  id: string;
  name: string;
}
interface Admin {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  business_id: string | null;
}

export default function AdminsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [resending, setResending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, a] = await Promise.all([
      fetch("/api/admin/businesses", { cache: "no-store" }),
      fetch("/api/admin/agents?role=admin", { cache: "no-store" }),
    ]);
    const cs = c.ok ? await c.json() : [];
    setCompanies(cs);
    if (cs.length && !companyId) setCompanyId(cs[0].id);
    setAdmins(a.ok ? await a.json() : []);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setNotice("");
    if (!email.trim() || !companyId) return setErr("Enter an email and pick a company.");
    setBusy(true);
    const r = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: name, business_id: companyId }),
    });
    setBusy(false);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(data.error || "Could not invite admin");
    setName("");
    setEmail("");
    setNotice(
      data.emailed
        ? `Invite emailed to ${data.email}. They'll set their own password.`
        : `Admin created. Email isn't configured, so share this link: ${data.reset_link ?? "(see server)"}`
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
    if (!confirm(`Remove admin ${who}?`)) return;
    setErr("");
    const r = await fetch(`/api/admin/agents/${id}`, { method: "DELETE" });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error || "Could not remove admin");
    await load();
  }

  const input =
    "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admins"
        description="Invite an admin for a company. They get a secure email link to set their own password — no shared passwords. Each admin manages only their own company's agents."
      />

      {err ? (
        <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:bg-danger-500/15 dark:text-danger-300">{err}</p>
      ) : null}
      {notice ? (
        <p className="rounded-lg bg-money-50 px-3 py-2 text-sm text-money-700 dark:bg-money-500/15 dark:text-money-300">{notice}</p>
      ) : null}

      <form
        onSubmit={invite}
        className="grid gap-2 rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end dark:border-ink-700/70 dark:bg-ink-900"
      >
        <label className="text-xs text-ink-500 dark:text-ink-400">
          Admin name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Broker" />
        </label>
        <label className="text-xs text-ink-500 dark:text-ink-400">
          Admin email
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@company.com" />
        </label>
        <label className="text-xs text-ink-500 dark:text-ink-400">
          Company
          <select className={input} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Choose…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
              <th className="px-4 py-3 font-semibold">Admin</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {admins === null ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-ink-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : admins.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-400">No admins yet — invite one above.</td></tr>
            ) : (
              admins.map((a) => (
                <tr key={a.id} className="hover:bg-paper-50 dark:hover:bg-ink-800/40">
                  <td className="px-4 py-3 font-medium text-ink-900 dark:text-ink-100">{a.full_name || "—"}</td>
                  <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{a.email}</td>
                  <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{a.company_name || "—"}</td>
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
                      <button onClick={() => remove(a.id, a.email)} className="text-ink-400 transition hover:text-danger-600" title="Remove admin">
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
    </div>
  );
}

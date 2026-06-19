"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { marketsLabel } from "@/lib/markets";
import { CountryMultiSelect } from "@/components/admin/CountryMultiSelect";

interface Company {
  id: string;
  name: string;
  markets: string;
  timezone: string;
  serviceArea: string;
}
interface Admin {
  id: string;
  email: string;
  role: string;
  business_id: string | null;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [markets, setMarkets] = useState<string[]>(["US"]);

  const load = useCallback(async () => {
    const c = await fetch("/api/admin/businesses", { cache: "no-store" });
    setCompanies(c.ok ? await c.json() : []);
    const a = await fetch("/api/admin/agents?role=admin", { cache: "no-store" }).catch(() => null);
    setAdmins(a && a.ok ? await a.json() : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCompany(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Company name is required.");
    if (markets.length === 0) return setErr("Pick at least one country (or Global).");
    setBusy(true);
    const r = await fetch("/api/admin/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, markets, serviceArea: area }),
    });
    setBusy(false);
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error || "Could not add company");
    setName("");
    setArea("");
    setMarkets(["US"]);
    await load();
  }

  async function removeCompany(id: string, cname: string) {
    if (!confirm(`Remove ${cname} and its access? This cannot be undone.`)) return;
    setErr("");
    const r = await fetch(`/api/admin/businesses/${id}`, { method: "DELETE" });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error || "Could not remove company");
    await load();
  }

  const input =
    "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Add real-estate companies to the platform, then invite each one an admin from the Admins page. You manage accounts — customer conversations stay private."
      />

      {err ? (
        <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:bg-danger-500/15 dark:text-danger-300">
          {err}
        </p>
      ) : null}

      {/* Add company */}
      <form
        onSubmit={addCompany}
        className="space-y-4 rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card dark:border-ink-700/70 dark:bg-ink-900"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
          <Building2 className="h-4 w-4 text-signal-500" /> New company
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-500 dark:text-ink-400">
            Company name
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lone Star Realty" />
          </label>
          <label className="text-xs text-ink-500 dark:text-ink-400">
            Service area
            <input className={input} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Austin, TX" />
          </label>
        </div>
        <div>
          <div className="mb-1 text-xs text-ink-500 dark:text-ink-400">
            Countries served — search & select multiple, or pick Global
          </div>
          <CountryMultiSelect value={markets} onChange={setMarkets} />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-signal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-signal-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add company
        </button>
      </form>

      {/* Company list */}
      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Markets</th>
              <th className="px-4 py-3 font-semibold">Service area</th>
              <th className="px-4 py-3 font-semibold text-right">Admins</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {companies === null ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : companies.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-400">No companies yet — add your first above.</td></tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id} className="hover:bg-paper-50 dark:hover:bg-ink-800/40">
                  <td className="px-4 py-3 font-medium text-ink-900 dark:text-ink-100">{c.name}</td>
                  <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{marketsLabel(c.markets)}</td>
                  <td className="px-4 py-3 text-ink-600 dark:text-ink-300">{c.serviceArea || "—"}</td>
                  <td className="px-4 py-3 text-right num text-ink-600 dark:text-ink-300">
                    {admins.filter((a) => a.business_id === c.id).length || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeCompany(c.id, c.name)} className="text-ink-400 transition hover:text-danger-600" title="Remove company">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

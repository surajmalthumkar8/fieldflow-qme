"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Plus, Rocket, Square, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

interface Campaign {
  id: string;
  title: string;
  description: string;
  offer: string;
  audience: "customers" | "agents" | "both";
  status: "draft" | "active" | "ended";
  live: boolean;
  startsAt: string | null;
  endsAt: string | null;
  interestCount: number | null;
}

interface Interest {
  id: string;
  userName: string;
  userEmail: string;
  note: string;
  createdAt: string | null;
}

const input =
  "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100";

export default function CampaignsPage() {
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [title, setTitle] = useState("");
  const [offer, setOffer] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<"customers" | "agents" | "both">("both");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [interests, setInterests] = useState<Record<string, Interest[]>>({});

  const load = useCallback(async () => {
    const r = await fetch("/api/campaigns", { cache: "no-store" });
    const data = await r.json().catch(() => ({ items: [] }));
    setItems(r.ok ? data.items : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!title.trim()) return setMsg("Give the campaign a title.");
    setBusy(true);
    const r = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        offer,
        description,
        audience,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      }),
    });
    setBusy(false);
    if (!r.ok) return setMsg("Could not create the campaign.");
    setTitle(""); setOffer(""); setDescription(""); setAudience("both"); setEndsAt("");
    setMsg("Saved as a draft — launch it when you're ready.");
    await load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    await load();
  }

  async function toggleInterests(id: string) {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    if (!interests[id]) {
      const r = await fetch(`/api/campaigns/${id}/interests`, { cache: "no-store" });
      const data = await r.json().catch(() => ({ items: [] }));
      setInterests((prev) => ({ ...prev, [id]: data.items || [] }));
    }
  }

  const statusChip = (c: Campaign) => {
    if (c.status === "active" && c.live)
      return <span className="rounded-full bg-money-100 px-2 py-0.5 text-[11px] font-medium text-money-700 dark:bg-money-500/15 dark:text-money-300">Live</span>;
    if (c.status === "active")
      return <span className="rounded-full bg-warn-100 px-2 py-0.5 text-[11px] font-medium text-warn-700 dark:bg-warn-500/15 dark:text-warn-300">Scheduled / ended window</span>;
    if (c.status === "ended")
      return <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500 dark:bg-ink-800 dark:text-ink-400">Ended</span>;
    return <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-500 dark:bg-ink-800 dark:text-ink-400">Draft</span>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns & Offers"
        description="Run limited-time offers and promotions. The AI receptionist mentions live offers to customers, your team is notified, and interested customers show up here for an agent to follow up."
      />

      {msg ? (
        <p className="rounded-lg bg-money-50 px-3 py-2 text-sm text-money-700 dark:bg-money-500/15 dark:text-money-300">{msg}</p>
      ) : null}

      {/* Create */}
      <form onSubmit={create} className="space-y-3 rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
          <Megaphone className="h-4 w-4 text-signal-500" /> New campaign
        </div>
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title — e.g. Spring Listing Special" />
        <input className={input} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Offer headline — e.g. 1% off listing fee this month" />
        <textarea className={input} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details the AI and your team can share…" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink-500 dark:text-ink-400">
            Audience
            <select className={`${input} mt-1`} value={audience} onChange={(e) => setAudience(e.target.value as "customers" | "agents" | "both")}>
              <option value="both">Customers &amp; team</option>
              <option value="customers">Customers only</option>
              <option value="agents">Team only</option>
            </select>
          </label>
          <label className="text-xs font-medium text-ink-500 dark:text-ink-400">
            Ends (optional — limited-time)
            <input type="datetime-local" className={`${input} mt-1`} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
        </div>
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-signal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-signal-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create draft
        </button>
      </form>

      {/* List */}
      <div className="space-y-3">
        {items === null ? (
          <div className="py-8 text-center text-ink-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-300 px-4 py-8 text-center text-sm text-ink-400 dark:border-ink-700">No campaigns yet — create your first offer above.</p>
        ) : (
          items.map((c) => (
            <div key={c.id} className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-900 dark:text-ink-100">{c.title}</span>
                    {statusChip(c)}
                  </div>
                  {c.offer ? <p className="mt-0.5 text-sm font-medium text-signal-600 dark:text-signal-400">{c.offer}</p> : null}
                  {c.description ? <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{c.description}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-ink-400">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.audience === "both" ? "Customers & team" : c.audience}</span>
                    {c.endsAt ? <span>Ends {new Date(c.endsAt).toLocaleDateString()}</span> : null}
                    <button onClick={() => toggleInterests(c.id)} className="font-medium text-signal-600 hover:underline dark:text-signal-400">
                      {c.interestCount ?? 0} interested
                    </button>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.status !== "active" ? (
                    <button onClick={() => patch(c.id, { status: "active" })} className="inline-flex items-center gap-1 rounded-lg bg-money-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-money-700">
                      <Rocket className="h-3.5 w-3.5" /> Launch
                    </button>
                  ) : (
                    <button onClick={() => patch(c.id, { status: "ended" })} className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800">
                      <Square className="h-3.5 w-3.5" /> End
                    </button>
                  )}
                  <button onClick={() => remove(c.id)} title="Delete" className="rounded-lg border border-ink-200 p-1.5 text-ink-400 hover:text-danger-600 dark:border-ink-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {openId === c.id ? (
                <div className="mt-3 border-t border-ink-100 pt-3 dark:border-ink-800">
                  {!interests[c.id] ? (
                    <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
                  ) : interests[c.id].length === 0 ? (
                    <p className="text-sm text-ink-400">No one's shown interest yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {interests[c.id].map((it) => (
                        <li key={it.id} className="flex items-center justify-between text-sm">
                          <span className="text-ink-700 dark:text-ink-200">{it.userName || it.userEmail || "Customer"}{it.note ? <span className="text-ink-400"> — {it.note}</span> : null}</span>
                          <span className="text-[11px] text-ink-400">{it.createdAt ? new Date(it.createdAt).toLocaleDateString() : ""}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

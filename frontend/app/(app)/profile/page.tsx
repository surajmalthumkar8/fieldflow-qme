"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Check, Loader2 } from "lucide-react";

interface Me {
  full_name: string;
  email: string;
  company_name: string;
  profile: Record<string, string>;
}

const FIELDS: { key: string; label: string; placeholder: string; type?: "select"; options?: string[] }[] = [
  { key: "phone", label: "Phone", placeholder: "+1 512 555 0100" },
  { key: "intent", label: "I'm looking to", placeholder: "", type: "select", options: ["Buy", "Sell", "Rent", "Invest", "Just exploring"] },
  { key: "propertyType", label: "Property type", placeholder: "single-family, condo, land…" },
  { key: "location", label: "Preferred location", placeholder: "Austin, Cedar Park…" },
  { key: "budget", label: "Budget", placeholder: "$650k" },
  { key: "timeline", label: "Timeline", placeholder: "next 3 months" },
  { key: "notes", label: "Anything else for our team", placeholder: "must-haves, financing status…" },
];

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [fullName, setFullName] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const u: Me = d?.user;
        if (u) {
          setMe(u);
          setFullName(u.full_name || "");
          setForm(u.profile || {});
        }
      })
      .catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const r = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, ...form }),
    });
    setSaving(false);
    if (r.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-[26px] font-bold text-ink-900 dark:text-ink-50">My Profile</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          {me ? (
            <>
              Welcome{me.full_name ? `, ${me.full_name.split(" ")[0]}` : ""} — you&apos;re a customer of{" "}
              <span className="font-semibold">{me.company_name}</span>. Fill this in so our AI receptionist can help you better.
            </>
          ) : (
            "Loading…"
          )}
        </p>
      </div>

      <form
        onSubmit={save}
        className="space-y-4 rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card dark:border-ink-700/70 dark:bg-ink-900"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-ink-500 dark:text-ink-400">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-signal-400 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-500 dark:text-ink-400">Email</span>
            <input
              value={me?.email ?? ""}
              disabled
              className="mt-1 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-500 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-400"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className={`block text-sm ${f.key === "notes" ? "sm:col-span-2" : ""}`}>
              <span className="text-ink-500 dark:text-ink-400">{f.label}</span>
              {f.type === "select" ? (
                <select
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-signal-400 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
                >
                  <option value="">Select…</option>
                  {f.options!.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-signal-400 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
                />
              )}
            </label>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-signal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-signal-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save profile
          </button>
          {saved ? (
            <span className="inline-flex items-center gap-1 text-sm text-money-600 dark:text-money-400">
              <Check className="h-4 w-4" /> Saved
            </span>
          ) : null}
          <Link
            href="/receptionist"
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 dark:bg-signal-600 dark:hover:bg-signal-700"
          >
            <Sparkles className="h-4 w-4" /> Talk to the AI Receptionist
          </Link>
        </div>
      </form>
    </div>
  );
}

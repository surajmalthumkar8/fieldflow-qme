"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Company {
  id: string;
  name: string;
  serviceArea?: string;
}

const REGIONS = [
  { value: "US", label: "United States — New York (ET)", tz: "America/New_York" },
  { value: "IN", label: "India — IST", tz: "Asia/Kolkata" },
];

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/receptionist";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [region, setRegion] = useState("US");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Load companies serving the selected region.
  useEffect(() => {
    fetch(`/api/businesses?region=${region}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Company[]) => {
        setCompanies(list);
        setBusinessId(list.length ? list[0].id : "");
      })
      .catch(() => {});
  }, [region]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const tz = REGIONS.find((r) => r.value === region)?.tz || "America/New_York";
    const body =
      mode === "login"
        ? { email, password }
        : { email, password, full_name: fullName, business_id: businessId, timezone: tz };
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    // If registering an existing account, just log in instead.
    if (mode === "register" && res.status === 409) {
      setMode("login");
      setError("That email already exists — try signing in.");
    } else {
      setError(data.error || "Something went wrong.");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0b1020] text-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-bold">
            T
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Techages AI</h1>
          <p className="text-sm text-slate-400">AI Receptionist — sign in to continue</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex rounded-lg bg-white/5 p-1 text-sm">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 rounded-md py-1.5 capitalize transition ${
                  mode === m ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {m === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <>
              <label className="block text-sm">
                <span className="text-slate-400">Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 outline-none focus:border-indigo-400"
                  placeholder="Jane Agent"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Region you're interested in</span>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 outline-none focus:border-indigo-400"
                >
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Company</span>
                <select
                  value={businessId}
                  onChange={(e) => setBusinessId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 outline-none focus:border-indigo-400"
                >
                  {companies.length === 0 ? (
                    <option value="">No companies available</option>
                  ) : (
                    companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.serviceArea ? ` — ${c.serviceArea}` : ""}
                      </option>
                    ))
                  )}
                </select>
                <span className="mt-1 block text-[11px] text-slate-500">
                  Register as a customer of one of our companies.
                </span>
              </label>
            </>
          )}

          <label className="block text-sm">
            <span className="text-slate-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 outline-none focus:border-indigo-400"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 outline-none focus:border-indigo-400"
            />
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-indigo-500 py-2.5 font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <p className="text-center text-xs text-slate-500">
            Sessions are JWT-backed (12h).
          </p>
        </form>
      </div>
    </main>
  );
}

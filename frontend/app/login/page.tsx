"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/receptionist";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("agent@techages.ai");
  const [password, setPassword] = useState("supersecret123");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        company_name: companyName,
        timezone,
      }),
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
                <span className="text-slate-400">Company name</span>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 outline-none focus:border-indigo-400"
                  placeholder="Lone Star Realty"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Timezone</span>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 outline-none focus:border-indigo-400"
                >
                  <option value="America/New_York">New York (US Eastern)</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                </select>
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
            Demo account is pre-filled. Sessions are JWT-backed (12h) on the FastAPI service.
          </p>
        </form>
      </div>
    </main>
  );
}

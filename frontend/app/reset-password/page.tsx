"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [state, setState] = useState<"checking" | "valid" | "invalid" | "done">("checking");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    void fetch(`/api/auth/password/token/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setEmail(d.email || "");
          setState("valid");
        } else {
          setState("invalid");
        }
      })
      .catch(() => setState("invalid"));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pwd.length < 8) return setError("Password must be at least 8 characters.");
    if (pwd !== pwd2) return setError("Passwords don't match.");
    setBusy(true);
    const r = await fetch("/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: pwd }),
    });
    setBusy(false);
    if (!r.ok) return setError((await r.json().catch(() => ({}))).error || "Could not set password.");
    setState("done");
    setTimeout(() => router.replace("/login"), 1800);
  }

  const input =
    "mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] px-3 py-2 outline-none focus:border-indigo-400";

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0b1020] text-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-bold">
            T
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Set your password</h1>
          <p className="text-sm text-slate-400">Techaegis AI — secure account setup</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          {state === "checking" && <p className="text-center text-sm text-slate-400">Checking your link…</p>}

          {state === "invalid" && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-rose-300">This link is invalid or has expired.</p>
              <button
                onClick={() => router.replace("/login")}
                className="w-full rounded-lg bg-indigo-500 py-2 font-semibold text-white hover:bg-indigo-600"
              >
                Go to sign in
              </button>
            </div>
          )}

          {state === "done" && (
            <div className="space-y-2 text-center">
              <p className="text-sm text-emerald-300">Password set! Taking you to sign in…</p>
            </div>
          )}

          {state === "valid" && (
            <form onSubmit={submit} className="space-y-4">
              {email ? (
                <p className="text-xs text-slate-400">
                  Setting the password for <span className="font-semibold text-slate-200">{email}</span>
                </p>
              ) : null}
              <label className="block text-sm">
                <span className="text-slate-400">New password</span>
                <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className={input} placeholder="At least 8 characters" />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">Confirm password</span>
                <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} className={input} placeholder="Re-enter password" />
              </label>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-indigo-500 py-2 font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Set password & continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0b1020]" />}>
      <ResetInner />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LogIn, LogOut } from "lucide-react";

// Homepage auth controls: "Log in" when signed out; "Dashboard" + "Sign out"
// when signed in. Auth state comes from the JWT cookie (checked via /api/auth/me).
export function AuthNav() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => alive && setAuthed(r.ok))
      .catch(() => alive && setAuthed(false));
    return () => {
      alive = false;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthed(false);
    router.refresh();
  }

  if (authed === null) {
    return <div className="h-9 w-24" aria-hidden />; // reserve space while loading
  }

  if (!authed) {
    return (
      <Link
        href="/login"
        className="group inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-paper-200"
      >
        <LogIn className="h-4 w-4" />
        Log in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/dashboard"
        className="group inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-paper-200"
      >
        Dashboard
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
      <button
        onClick={logout}
        className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}

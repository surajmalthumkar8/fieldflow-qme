import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";
const TOKEN_COOKIE = "ff_token";

export async function POST() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (token && BACKEND) {
    // Best-effort revoke on the backend; ignore failures.
    try {
      await fetch(`${BACKEND}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch {
      /* ignore */
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

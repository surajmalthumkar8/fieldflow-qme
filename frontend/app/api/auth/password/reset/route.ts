import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Public: set a new password from a one-time token.
export async function POST(req: Request) {
  if (!BACKEND) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${BACKEND}/auth/password/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return NextResponse.json({ error: data.detail || "Could not reset password" }, { status: r.status });
  }
  return NextResponse.json(data);
}

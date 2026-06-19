import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Public: request a password-reset email. Always returns ok (no user enumeration).
export async function POST(req: Request) {
  if (!BACKEND) return NextResponse.json({ ok: true });
  const body = await req.json().catch(() => ({}));
  await fetch(`${BACKEND}/auth/password/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}

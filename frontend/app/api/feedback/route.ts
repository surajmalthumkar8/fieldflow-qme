import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Customer submits feedback (e.g. after booking). Auth-scoped to their company.
export async function POST(req: Request) {
  if (!BACKEND) return NextResponse.json({ ok: false }, { status: 503 });
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${BACKEND}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}

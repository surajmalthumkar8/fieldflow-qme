import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// List the company's campaigns (admin) / create a campaign (admin). The backend
// scopes to the caller's business from the JWT — we forward the token.
export async function GET() {
  if (!BACKEND) return NextResponse.json({ items: [] }, { status: 503 });
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ items: [] }, { status: 401 });
  const r = await fetch(`${BACKEND}/campaigns`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(await r.json().catch(() => ({ items: [] })), { status: r.status });
}

export async function POST(req: Request) {
  if (!BACKEND) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${BACKEND}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}

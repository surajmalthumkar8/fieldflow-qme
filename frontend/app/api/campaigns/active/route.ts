import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Live offers for the signed-in user (customer/agent). Backend filters by audience + role.
export async function GET() {
  if (!BACKEND) return NextResponse.json({ items: [] }, { status: 503 });
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ items: [] }, { status: 401 });
  const r = await fetch(`${BACKEND}/campaigns/active`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(await r.json().catch(() => ({ items: [] })), { status: r.status });
}

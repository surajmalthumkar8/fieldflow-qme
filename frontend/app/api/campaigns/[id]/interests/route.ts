import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Customers who registered interest in a campaign (admin/agent follow-up). Scoped by JWT.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("ff_token")?.value;
  if (!BACKEND || !token) return NextResponse.json({ items: [] }, { status: 401 });
  const r = await fetch(`${BACKEND}/campaigns/${encodeURIComponent(id)}/interests`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(await r.json().catch(() => ({ items: [] })), { status: r.status });
}

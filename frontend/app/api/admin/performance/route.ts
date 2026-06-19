import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Per-agent / per-company performance aggregates. Admin only.
export async function GET() {
  const user = await getCurrentUser();
  // Revenue view is for company admins only — super_admin uses /admin/insights.
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/admin/performance`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) {
    return NextResponse.json({ agents: [], companies: [], totals: {} }, { status: r.status });
  }
  return NextResponse.json(await r.json());
}

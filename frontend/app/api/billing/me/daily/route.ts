import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Daily usage-cost breakdown for the Cost Analyzer charts.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role === "customer" || user.role === "super_admin") {
    return NextResponse.json({ trend: [] }, { status: 403 });
  }
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/billing/me/daily`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  return NextResponse.json(r.ok ? await r.json() : { trend: [] });
}

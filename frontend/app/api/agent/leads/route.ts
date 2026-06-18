import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// The agent's company leads (auto-scored). Agents/admins only.
export async function GET() {
  const user = await getCurrentUser();
  if (!BACKEND || !user || user.role === "customer") {
    return NextResponse.json([], { status: user?.role === "customer" ? 403 : 401 });
  }
  if (!user.business_id) return NextResponse.json([]);
  const r = await fetch(`${BACKEND}/agent/leads?business_id=${encodeURIComponent(user.business_id)}`, {
    cache: "no-store",
  });
  return NextResponse.json(r.ok ? await r.json() : []);
}

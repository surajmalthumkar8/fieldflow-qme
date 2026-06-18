import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// An agent claims a lead/call ("I'll take this").
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!BACKEND || !user || user.role === "customer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const r = await fetch(`${BACKEND}/agent/leads/${encodeURIComponent(id)}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: user.id, agent_name: user.full_name || user.email }),
    cache: "no-store",
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Assign a lead. An agent self-claims ("I'll take this"); an admin may assign to a
// specific agent by passing { agent_id, agent_name }. The backend enforces same-company
// + that agents can only self-assign — we just forward the token + intent.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!BACKEND || !user || user.role === "customer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const assignTo =
    user.role === "admin" && body?.agent_id
      ? { agent_id: String(body.agent_id), agent_name: String(body.agent_name ?? "") }
      : { agent_id: user.id, agent_name: user.full_name || user.email };
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/agent/leads/${encodeURIComponent(id)}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(assignTo),
    cache: "no-store",
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}

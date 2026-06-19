import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Send a message into the agent↔customer thread (sender derived from the role).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${BACKEND}/messaging/thread/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content: body?.content ?? "", kind: body?.kind ?? "text" }),
    cache: "no-store",
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Read the agent↔customer thread for a conversation (agent or customer).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ thread: null, messages: [] }, { status: 401 });
  const r = await fetch(`${BACKEND}/messaging/thread/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ thread: null, messages: [] }, { status: r.status });
  return NextResponse.json(await r.json());
}

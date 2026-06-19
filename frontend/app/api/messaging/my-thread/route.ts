import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// The signed-in customer's agent thread (by who they are, not the current session).
export async function GET() {
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ conversationId: null, hasAgent: false, messages: [] }, { status: 401 });
  const r = await fetch(`${BACKEND}/messaging/my-thread`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ conversationId: null, hasAgent: false, messages: [] }, { status: r.status });
  return NextResponse.json(await r.json());
}

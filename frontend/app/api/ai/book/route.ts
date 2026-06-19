import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Book an agent-call slot (atomic, conflict-safe) and get back the calendar invite.
export async function POST(req: Request) {
  if (!BACKEND) return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ error: "Please sign in to book." }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const r = await fetch(`${BACKEND}/schedule/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  // Pass through 409 (slot taken) so the UI can ask them to re-pick.
  return NextResponse.json(data, { status: r.status });
}

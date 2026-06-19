import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Unread message count for the current user (drives the notification bell).
export async function GET() {
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ unread: 0 }, { status: 401 });
  const r = await fetch(`${BACKEND}/messaging/unread`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(r.ok ? await r.json() : { unread: 0 });
}

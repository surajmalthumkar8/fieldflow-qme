import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Predefined questions an agent can tap to send.
export async function GET() {
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ questions: [] }, { status: 401 });
  const r = await fetch(`${BACKEND}/messaging/question-library`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(r.ok ? await r.json() : { questions: [] });
}

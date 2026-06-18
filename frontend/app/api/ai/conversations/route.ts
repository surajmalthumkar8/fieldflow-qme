import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// The signed-in user's own conversation history (scoped by user_id + company).
export async function GET() {
  const user = await getCurrentUser();
  if (!BACKEND || !user?.business_id) return NextResponse.json([]);
  const url = `${BACKEND}/conversations?business_id=${encodeURIComponent(user.business_id)}&user_id=${encodeURIComponent(user.id)}`;
  const r = await fetch(url, { cache: "no-store" });
  return NextResponse.json(r.ok ? await r.json() : []);
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// The signed-in customer's own conversation history. The backend scopes a customer
// to their own conversations from the JWT — we just forward the token.
export async function GET() {
  const user = await getCurrentUser();
  if (!BACKEND || !user) return NextResponse.json([]);
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(r.ok ? await r.json() : []);
}

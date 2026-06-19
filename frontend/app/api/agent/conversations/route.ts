import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// All of the company's AI receptionist conversations (agent/admin view). The backend
// scopes to the caller's company from the JWT — we forward the token.
export async function GET() {
  const user = await getCurrentUser();
  if (!BACKEND || !user || user.role === "customer") {
    return NextResponse.json([], { status: user?.role === "customer" ? 403 : 401 });
  }
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/conversations?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(r.ok ? await r.json() : []);
}

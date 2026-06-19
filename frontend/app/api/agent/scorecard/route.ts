import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// The signed-in agent's own performance scorecard.
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "agent") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/agent/me/scorecard`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({}, { status: r.status });
  return NextResponse.json(await r.json());
}

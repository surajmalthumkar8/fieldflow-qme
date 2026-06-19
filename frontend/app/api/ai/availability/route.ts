import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Free agent-call slots for a business in the requested timezone.
export async function GET(req: Request) {
  if (!BACKEND) return NextResponse.json({ slots: [] });
  const token = (await cookies()).get("ff_token")?.value;
  if (!token) return NextResponse.json({ slots: [] }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("business_id") || "default";
  const tz = searchParams.get("tz") || "America/New_York";
  const after = searchParams.get("after") || "";
  const qs = new URLSearchParams({ business_id: businessId, tz });
  if (after) qs.set("after", after);
  const r = await fetch(`${BACKEND}/schedule/availability?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ slots: [] }, { status: 502 });
  return NextResponse.json(await r.json());
}

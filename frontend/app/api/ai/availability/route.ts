import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Free agent-call slots for a business in the requested timezone.
export async function GET(req: Request) {
  if (!BACKEND) return NextResponse.json({ slots: [] });
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("business_id") || "default";
  const tz = searchParams.get("tz") || "America/New_York";
  const r = await fetch(
    `${BACKEND}/schedule/availability?business_id=${encodeURIComponent(businessId)}&tz=${encodeURIComponent(tz)}`,
    { cache: "no-store" }
  );
  if (!r.ok) return NextResponse.json({ slots: [] }, { status: 502 });
  return NextResponse.json(await r.json());
}

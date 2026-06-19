import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { servesRegion } from "@/lib/markets";

export const dynamic = "force-dynamic";

// Public: the companies a customer can register under (real-estate tenants we host),
// optionally filtered by region (?region=US|IN). A company matches a region if it
// serves that market OR is Global. Used by the registration dropdown.
export async function GET(req: Request) {
  const region = new URL(req.url).searchParams.get("region"); // "US" | "IN" | ...
  const businesses = await prisma.business.findMany({
    where: { trade: "real_estate" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, serviceArea: true, markets: true, timezone: true },
  });
  const filtered = region ? businesses.filter((b) => servesRegion(b.markets, region)) : businesses;
  return NextResponse.json(filtered);
}

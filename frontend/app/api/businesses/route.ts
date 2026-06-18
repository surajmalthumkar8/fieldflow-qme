import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public: the companies a customer can register under (real-estate tenants we host),
// optionally filtered by region (?region=US|IN). Used by the registration dropdown.
export async function GET(req: Request) {
  const region = new URL(req.url).searchParams.get("region"); // "US" | "IN"
  const businesses = await prisma.business.findMany({
    where: {
      trade: "real_estate",
      ...(region ? { markets: { contains: region } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, serviceArea: true, markets: true, timezone: true },
  });
  return NextResponse.json(businesses);
}

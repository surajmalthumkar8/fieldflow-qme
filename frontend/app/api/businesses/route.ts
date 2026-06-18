import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public: the companies a customer can register under (real-estate tenants we host).
// Used by the registration dropdown.
export async function GET() {
  const businesses = await prisma.business.findMany({
    where: { trade: "real_estate" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, serviceArea: true },
  });
  return NextResponse.json(businesses);
}

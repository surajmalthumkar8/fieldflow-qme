import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

interface ByCompany {
  businessId: string;
  conversations: number;
  bookings: number;
  lastActive: string | null;
  companyName?: string;
}

// Platform analytics for the super_admin dashboard. Merges the AI activity from
// FastAPI with company names + onboarding counts from Prisma. NON-financial only.
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "super_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const token = (await cookies()).get("ff_token")?.value;
  const [r, companies] = await Promise.all([
    fetch(`${BACKEND}/admin/insights`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
    prisma.business.findMany({
      where: { trade: "real_estate" },
      select: { id: true, name: true, markets: true, createdAt: true },
    }),
  ]);

  const data = r.ok ? await r.json() : { totals: {}, trend: [], byCompany: [] };
  const nameById = new Map(companies.map((c) => [c.id, c.name]));

  // Attach names; keep only companies that still exist.
  const byCompany: ByCompany[] = (data.byCompany ?? [])
    .filter((b: ByCompany) => nameById.has(b.businessId))
    .map((b: ByCompany) => ({ ...b, companyName: nameById.get(b.businessId) }));

  // Companies with zero activity still count as onboarded — show them too.
  const activeIds = new Set(byCompany.map((b) => b.businessId));
  for (const c of companies) {
    if (!activeIds.has(c.id)) {
      byCompany.push({ businessId: c.id, companyName: c.name, conversations: 0, bookings: 0, lastActive: null });
    }
  }
  byCompany.sort((a, b) => b.conversations - a.conversations);

  return NextResponse.json({
    ...data,
    byCompany,
    totals: {
      ...data.totals,
      totalCompanies: companies.length,
      activeCompanies: byCompany.filter((b) => b.conversations > 0).length,
    },
  });
}

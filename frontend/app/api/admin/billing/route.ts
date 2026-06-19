import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

interface Company { businessId: string; companyName?: string }

// Platform revenue (super_admin) — merges company names from Prisma.
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "super_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const token = (await cookies()).get("ff_token")?.value;
  const [r, companies] = await Promise.all([
    fetch(`${BACKEND}/admin/billing`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
    prisma.business.findMany({ select: { id: true, name: true } }),
  ]);
  const data = r.ok ? await r.json() : { summary: {}, companies: [], trend: [] };
  const nameById = new Map(companies.map((c) => [c.id, c.name]));
  data.companies = (data.companies ?? []).map((c: Company) => ({ ...c, companyName: nameById.get(c.businessId) ?? "—" }));
  return NextResponse.json(data);
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

interface Escalation {
  id: string;
  businessId: string;
  rating: number;
  comment: string;
  category: string;
  note: string;
  createdAt: string | null;
  companyName?: string;
}

// Platform escalations inbox (super_admin) — adds company names from Prisma.
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "super_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const token = (await cookies()).get("ff_token")?.value;
  const [r, companies] = await Promise.all([
    fetch(`${BACKEND}/feedback/escalations`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
    prisma.business.findMany({ select: { id: true, name: true } }),
  ]);
  const data = r.ok ? await r.json() : { items: [] };
  const nameById = new Map(companies.map((c) => [c.id, c.name]));
  const items: Escalation[] = (data.items ?? []).map((e: Escalation) => ({
    ...e,
    companyName: nameById.get(e.businessId) ?? "—",
  }));
  return NextResponse.json({ items });
}

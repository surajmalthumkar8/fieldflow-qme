import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/authServer";
import { toMarketsCsv, tzForMarkets, parseMarkets } from "@/lib/markets";

export const dynamic = "force-dynamic";

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

// Only the platform (super_admin) manages companies.
async function requireSuper() {
  const user = await getCurrentUser();
  return user?.role === "super_admin" ? user : null;
}

export async function GET() {
  // Both super_admin (manage) and admins (the company dropdown) may list.
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const businesses = await prisma.business.findMany({
    where: { trade: "real_estate" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, markets: true, timezone: true, serviceArea: true },
  });
  return NextResponse.json(businesses);
}

export async function POST(req: Request) {
  if (!(await requireSuper())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: { name?: string; markets?: string[] | string; timezone?: string; serviceArea?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const name = (b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  // Accept a multi-select array (preferred) or a CSV string; default US.
  const selected = Array.isArray(b.markets) ? b.markets : parseMarkets(b.markets as string);
  const markets = toMarketsCsv(selected.length ? selected : ["US"]);
  const timezone = b.timezone || tzForMarkets(parseMarkets(markets));
  // Companies and admins are managed separately: add the company here, then invite
  // its admin from the Admins page (which emails them a set-password link).
  const created = await prisma.business.create({
    data: {
      name,
      slug: slugify(name),
      trade: "real_estate",
      markets,
      timezone,
      serviceArea: b.serviceArea || "",
      brandVoice: "warm, professional, helpful",
    },
    select: { id: true, name: true, markets: true },
  });
  return NextResponse.json(created, { status: 201 });
}

// Lightweight demo "tenant selection" — which Business the dashboard is viewing.
// Real multi-tenant auth (Supabase Auth + RLS on businessId) is the documented
// production swap; for the demo we keep an active-business cookie, no passwords.

import { cookies } from "next/headers";
import { prisma } from "./db";

const COOKIE = "qme_business";

export async function getActiveBusinessId(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(COOKIE)?.value;
  if (fromCookie) {
    const exists = await prisma.business.findUnique({ where: { id: fromCookie }, select: { id: true } });
    if (exists) return exists.id;
  }
  // Default to the first business (seeded demo tenant).
  const first = await prisma.business.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return first?.id ?? null;
}

export async function getActiveBusiness() {
  const id = await getActiveBusinessId();
  if (!id) return null;
  return prisma.business.findUnique({ where: { id } });
}

export async function listBusinesses() {
  return prisma.business.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, slug: true, trade: true } });
}

export const ACTIVE_BUSINESS_COOKIE = COOKIE;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";

// Remove a real-estate company. Admin only. Refuses if agents still belong to it
// (remove the agents first) so we never silently orphan accounts.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "super_admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const business = await prisma.business.findUnique({ where: { id } });
  if (!business) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  await prisma.business.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

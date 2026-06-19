import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Invite a teammate with a set-password email link:
//  - super_admin invites a company ADMIN (must pick a company).
//  - a company admin invites an AGENT (backend forces their own company).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const b: { email?: string; full_name?: string; business_id?: string } = await req.json().catch(() => ({}));

  // Build the invite payload per role.
  let payload: Record<string, unknown>;
  if (user.role === "super_admin") {
    if (!b.business_id) return NextResponse.json({ error: "Choose a company" }, { status: 400 });
    const business = await prisma.business.findUnique({ where: { id: b.business_id } });
    if (!business) return NextResponse.json({ error: "Company not found" }, { status: 400 });
    payload = {
      email: b.email,
      full_name: b.full_name ?? "",
      business_id: business.id,
      company_name: business.name,
      timezone: business.timezone,
      role: "admin",
    };
  } else {
    // Admin → agent in their own company (backend enforces scope).
    payload = { email: b.email, full_name: b.full_name ?? "", role: "agent" };
  }

  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/auth/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const status = r.status === 409 ? 409 : 400;
    return NextResponse.json(
      { error: data.detail || (status === 409 ? "That email is already registered" : "Could not invite admin") },
      { status }
    );
  }
  return NextResponse.json(data, { status: 201 });
}

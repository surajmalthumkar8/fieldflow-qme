import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// super_admin and company admins manage agents. A company admin only ever sees /
// creates agents in their OWN company (enforced here AND in the backend).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Default to agents; super_admin may request role=admin (e.g. company admin counts).
  const reqRole = new URL(req.url).searchParams.get("role") || "agent";
  const role = reqRole === "admin" && user.role === "super_admin" ? "admin" : "agent";
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/admin/users?role=${role}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(r.ok ? await r.json() : []);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let b: { email?: string; password?: string; full_name?: string; business_id?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // A company admin can only create agents in their own company; a super_admin
  // chooses the company.
  const businessId = user.role === "admin" ? user.business_id ?? undefined : b.business_id;
  if (!businessId) return NextResponse.json({ error: "Choose a company" }, { status: 400 });
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return NextResponse.json({ error: "Company not found" }, { status: 400 });

  // Create the agent via the auth-gated invite flow (emails a set-password link) —
  // never the public register endpoint.
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/auth/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      email: b.email,
      full_name: b.full_name ?? "",
      business_id: business.id,
      company_name: business.name,
      timezone: business.timezone,
      role: "agent",
    }),
    cache: "no-store",
  });
  if (!r.ok) {
    const status = r.status === 409 ? 409 : 400;
    return NextResponse.json(
      { error: status === 409 ? "That email is already registered" : "Could not create agent" },
      { status }
    );
  }
  const data = await r.json();
  return NextResponse.json({ ok: true, user: data }, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";
const TOKEN_COOKIE = "ff_token";

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

// Registration creates the COMPANY (a real tenant) + the admin user, links them,
// and activates the company — so the dashboard + receptionist immediately use it.
export async function POST(req: Request) {
  if (!BACKEND) return NextResponse.json({ error: "AI_SERVICE_URL not configured" }, { status: 503 });
  let body: {
    email?: string;
    password?: string;
    full_name?: string;
    company_name?: string;
    timezone?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyName = (body.company_name || "").trim() || "My Real Estate Co.";
  const timezone = body.timezone || "America/New_York";

  // 1) Create the company tenant (Prisma Business).
  const business = await prisma.business.create({
    data: {
      name: companyName,
      slug: slugify(companyName),
      trade: "real_estate",
      timezone,
      brandVoice: "warm, professional, helpful",
    },
  });

  // 2) Create the admin user in the auth service, linked to the company.
  const r = await fetch(`${BACKEND}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      full_name: body.full_name ?? "",
      company_name: companyName,
      timezone,
      business_id: business.id,
      role: "admin",
    }),
    cache: "no-store",
  });
  if (!r.ok) {
    // Roll back the company if the user couldn't be created (e.g. email taken).
    await prisma.business.delete({ where: { id: business.id } }).catch(() => {});
    const status = r.status === 409 ? 409 : 400;
    return NextResponse.json(
      { error: status === 409 ? "Email already registered" : "Could not register" },
      { status }
    );
  }

  const data = await r.json();
  const res = NextResponse.json({ user: data.user });
  res.cookies.set(TOKEN_COOKIE, data.access_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  // 3) Activate the new company for this session.
  res.cookies.set(ACTIVE_BUSINESS_COOKIE, business.id, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return res;
}

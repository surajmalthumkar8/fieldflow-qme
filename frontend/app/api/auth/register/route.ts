import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";
const TOKEN_COOKIE = "ff_token";

// A customer registers UNDER an existing company (chosen from the dropdown of the
// businesses we host). We link the user to that company and activate it.
export async function POST(req: Request) {
  if (!BACKEND) return NextResponse.json({ error: "AI_SERVICE_URL not configured" }, { status: 503 });
  let body: { email?: string; password?: string; full_name?: string; business_id?: string; timezone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.business_id) {
    return NextResponse.json({ error: "Please choose your company." }, { status: 400 });
  }
  const business = await prisma.business.findUnique({ where: { id: body.business_id } });
  if (!business) {
    return NextResponse.json({ error: "That company doesn't exist." }, { status: 400 });
  }

  const r = await fetch(`${BACKEND}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      full_name: body.full_name ?? "",
      company_name: business.name,
      // The customer's chosen region timezone (falls back to the company's).
      timezone: body.timezone || business.timezone,
      business_id: business.id,
      role: "customer", // self-registration is always a customer (agents are invited)
    }),
    cache: "no-store",
  });
  if (!r.ok) {
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
  res.cookies.set(ACTIVE_BUSINESS_COOKIE, business.id, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  // Readable role cookie (UI/routing only; data access is still JWT-gated).
  res.cookies.set("ff_role", data?.user?.role ?? "customer", { sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return res;
}

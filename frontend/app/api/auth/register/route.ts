import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";
const TOKEN_COOKIE = "ff_token";

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
  const r = await fetch(`${BACKEND}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      full_name: body.full_name ?? "",
      company_name: body.company_name ?? "",
      timezone: body.timezone ?? "America/New_York",
      role: "admin",
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
  return res;
}

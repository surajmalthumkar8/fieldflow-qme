import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";
const TOKEN_COOKIE = "ff_token";

// Proxy login to the FastAPI auth service and stash the JWT in an httpOnly cookie.
export async function POST(req: Request) {
  if (!BACKEND) {
    return NextResponse.json({ error: "AI_SERVICE_URL not configured" }, { status: 503 });
  }
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const r = await fetch(`${BACKEND}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  });
  if (!r.ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const data = await r.json();
  const res = NextResponse.json({ user: data.user });
  res.cookies.set(TOKEN_COOKIE, data.access_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h, matches backend session
  });
  // Activate the user's company so the dashboard + receptionist show THEIR tenant.
  const businessId = data?.user?.business_id;
  if (businessId) {
    res.cookies.set("qme_business", businessId, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  }
  return res;
}

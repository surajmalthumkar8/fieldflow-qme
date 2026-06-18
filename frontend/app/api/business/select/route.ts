import { NextResponse } from "next/server";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  let businessId: string | undefined;
  try {
    ({ businessId } = (await req.json()) as { businessId?: string });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!businessId) {
    return NextResponse.json({ ok: false, error: "businessId required" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

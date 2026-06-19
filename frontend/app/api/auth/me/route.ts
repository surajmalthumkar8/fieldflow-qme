import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";
const TOKEN_COOKIE = "ff_token";

export async function GET() {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token || !BACKEND) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const r = await fetch(`${BACKEND}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: await r.json() });
}

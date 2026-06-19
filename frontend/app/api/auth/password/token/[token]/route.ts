import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Public: check whether a set-password link is still valid.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!BACKEND) return NextResponse.json({ valid: false });
  const { token } = await params;
  const r = await fetch(`${BACKEND}/auth/password/token/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  return NextResponse.json(r.ok ? await r.json() : { valid: false });
}

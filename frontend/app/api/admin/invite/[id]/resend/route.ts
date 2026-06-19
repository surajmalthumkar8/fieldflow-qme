import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Re-send the set-password link. super_admin → any user; admin → their own agents.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/auth/invite/${encodeURIComponent(id)}/resend`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return NextResponse.json({ error: data.detail || "Could not resend" }, { status: r.status });
  return NextResponse.json(data);
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// On-demand AI insight for an agent about one customer.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "agent" && user.role !== "admin" && user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/agent/insight`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_id: body?.conversation_id ?? "",
      refresh: Boolean(body?.refresh),
      cached_only: Boolean(body?.cached_only),
    }),
    cache: "no-store",
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Remove an agent. Admin only. Proxies to the FastAPI auth store.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    return NextResponse.json({ error: data.detail || "Could not remove agent" }, { status: r.status });
  }
  return NextResponse.json({ ok: true });
}

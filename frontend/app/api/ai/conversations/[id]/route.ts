import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Load one conversation's full transcript (to resume it).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!BACKEND || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await fetch(`${BACKEND}/conversations/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!r.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(await r.json());
}

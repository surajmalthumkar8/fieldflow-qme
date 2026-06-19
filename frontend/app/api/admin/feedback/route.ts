import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Feedback rows + aggregates. admin = own company; super_admin = all companies.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/feedback`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ totals: {}, byCategory: {}, byRating: {}, trend: [], items: [] }, { status: r.status });
  return NextResponse.json(await r.json());
}

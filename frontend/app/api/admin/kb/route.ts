import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Knowledge base for the admin's own company. GET lists docs; POST ingests text
// (chunk + embed + meter as rag_ingest). Admin only.
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "admin" || !user.business_id) return NextResponse.json([], { status: 403 });
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/kb/documents?business_id=${encodeURIComponent(user.business_id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return NextResponse.json(r.ok ? await r.json() : []);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin" || !user.business_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b?.content?.trim()) return NextResponse.json({ error: "Add some text to train on" }, { status: 400 });
  const token = (await cookies()).get("ff_token")?.value;
  const r = await fetch(`${BACKEND}/kb/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      business_id: user.business_id,
      title: (b.title || "Untitled").slice(0, 200),
      source: "manual",
      content: String(b.content),
    }),
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return NextResponse.json({ error: "Could not ingest" }, { status: r.status });
  return NextResponse.json(data, { status: 201 });
}

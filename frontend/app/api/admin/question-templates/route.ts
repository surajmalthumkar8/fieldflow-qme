import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

async function tok() {
  return (await cookies()).get("ff_token")?.value;
}

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json([], { status: 403 });
  const r = await fetch(`${BACKEND}/messaging/question-templates`, {
    headers: { Authorization: `Bearer ${await tok()}` },
    cache: "no-store",
  });
  return NextResponse.json(r.ok ? await r.json() : []);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const r = await fetch(`${BACKEND}/messaging/question-templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await tok()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: b?.text ?? "" }),
    cache: "no-store",
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}

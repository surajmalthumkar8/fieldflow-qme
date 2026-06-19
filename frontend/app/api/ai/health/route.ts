import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Live status of the local AI engine (FastAPI + Ollama) for the top-bar badge.
export async function GET() {
  if (!BACKEND) return NextResponse.json({ online: false, ollama: false });
  try {
    const r = await fetch(`${BACKEND}/health`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!r.ok) return NextResponse.json({ online: false, ollama: false });
    const d = await r.json();
    return NextResponse.json({
      online: Boolean(d.ollama) && d.status === "ok",
      ollama: Boolean(d.ollama),
      database: Boolean(d.database),
    });
  } catch {
    return NextResponse.json({ online: false, ollama: false });
  }
}

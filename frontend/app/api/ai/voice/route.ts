import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

// Proxy text -> WAV (the natural female voice, Kokoro when installed) so the
// browser can play same-origin audio instead of its robotic built-in TTS.
export async function POST(req: Request) {
  if (!BACKEND) return NextResponse.json({ error: "AI_SERVICE_URL not configured" }, { status: 503 });
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const r = await fetch(`${BACKEND}/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "voice unavailable" }, { status: 502 });

  const audio = await r.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/wav",
      "X-TTS-Provider": r.headers.get("X-TTS-Provider") ?? "unknown",
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { aiQualify, aiServiceEnabled, type AiTurn } from "@/lib/aiService";

export const dynamic = "force-dynamic";

// Lead engine: score a conversation transcript (HOT/WARM/COLD + lead/intent
// scores + budget + opportunity + captured fields) via the FastAPI/Ollama service.
export async function POST(req: Request) {
  if (!aiServiceEnabled()) {
    return NextResponse.json({ error: "AI_SERVICE_URL is not configured." }, { status: 503 });
  }
  let body: { history?: AiTurn[] };
  try {
    body = (await req.json()) as { history?: AiTurn[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const history = Array.isArray(body.history) ? body.history : [];
  if (!history.length) {
    return NextResponse.json({ error: "history required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await aiQualify(history));
  } catch (err) {
    console.error("[/api/ai/qualify] error:", err);
    return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
  }
}

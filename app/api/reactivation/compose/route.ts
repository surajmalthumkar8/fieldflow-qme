import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/session";
import { runBrain } from "@/lib/ai/brain";
import { DISCLOSURES } from "@/lib/compliance";

// AI-compose the reactivation opener. We ask the brain (reactivation mode) for
// a believable opening text given a season/offer prompt, then append the
// required STOP footer. Returns the suggested text for the operator to edit.
export async function POST(req: Request) {
  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json({ ok: false, error: "No active business" }, { status: 400 });
  }

  let body: { prompt?: string };
  try {
    body = (await req.json()) as { prompt?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").trim();

  try {
    const ask =
      `Write the opening reactivation text we'll send to past customers. ` +
      (prompt
        ? `Tie it to this season/offer angle: "${prompt}". `
        : `Use a seasonal tune-up / "we'd love to get you back on the schedule" angle. `) +
      `Keep it warm, under 2 sentences, end with a clear ask to reply YES for a time. Do not include any opt-out footer.`;

    const result = await runBrain({
      business,
      mode: "reactivation",
      history: [],
      userMessage: ask,
    });

    // Strip any footer the model may have added, then append the canonical one.
    // Robust to a trailing multiline "Reply STOP…" line + any leading whitespace.
    const cleaned = result.reply.replace(/\s*reply stop[\s\S]*$/i, "").trim();
    const text = `${cleaned}\n\n${DISCLOSURES.smsFooter}`;

    return NextResponse.json({ ok: true, text, engine: result.engine });
  } catch (err) {
    console.error("[reactivation/compose] failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to compose message" }, { status: 500 });
  }
}

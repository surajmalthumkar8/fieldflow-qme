import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/session";
import { sendSms } from "@/lib/integrations";

// Launch the (simulated) reactivation campaign. CONSENT GATE: we only message
// leads where smsEligible === true (written/re-consent + DNC/Reassigned clear).
// One OUTBOUND SMS conversation per lead — never re-text a lead already launched.
export async function POST(req: Request) {
  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json({ ok: false, error: "No active business" }, { status: 400 });
  }

  let body: { message?: string };
  try {
    body = (await req.json()) as { message?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });
  }

  try {
    // HARD GATE: only SMS-eligible leads.
    const eligibleLeads = await prisma.lead.findMany({
      where: { businessId: business.id, smsEligible: true },
      select: { id: true, phone: true },
    });

    // Leads already in an OUTBOUND SMS conversation — skip them.
    const existing = await prisma.conversation.findMany({
      where: {
        businessId: business.id,
        channel: "SMS",
        direction: "OUTBOUND",
        leadId: { in: eligibleLeads.map((l) => l.id) },
      },
      select: { leadId: true },
    });
    const alreadyLaunched = new Set(existing.map((c) => c.leadId));

    let sent = 0;
    let mode: "live" | "simulated" = "simulated";

    for (const lead of eligibleLeads) {
      if (alreadyLaunched.has(lead.id)) continue;

      const send = await sendSms({ to: lead.phone, from: business.fromNumber, body: message });
      mode = send.mode;

      await prisma.conversation.create({
        data: {
          businessId: business.id,
          leadId: lead.id,
          channel: "SMS",
          direction: "OUTBOUND",
          status: "ACTIVE",
          outcome: "",
          summary: "Reactivation campaign",
          messages: {
            create: [{ role: "ASSISTANT", content: message }],
          },
        },
      });
      sent++;
    }

    return NextResponse.json({ ok: true, sent, mode });
  } catch (err) {
    console.error("[reactivation/launch] failed:", err);
    return NextResponse.json({ ok: false, error: "Failed to launch campaign" }, { status: 500 });
  }
}

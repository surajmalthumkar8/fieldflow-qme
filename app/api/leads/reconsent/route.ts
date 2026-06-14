import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/session";
import { isSmsEligible, reconsentMessage } from "@/lib/compliance";
import { sendSms } from "@/lib/integrations";

// Re-consent gate actions (the validated strategy requires the re-consent
// request to be an OPERATOR-INITIATED one-off — a human clicks Send — NOT pushed
// through the automated A2P campaign dialer):
//  - action "send":    operator-initiated one-off re-consent request (pre-automation)
//  - action "confirm": lead replied YES -> mark RECONSENTED + recompute SMS eligibility
//
// Eligibility is NEVER granted on send — it only comes from the confirm path
// after the customer affirmatively replies YES.
export async function POST(req: Request) {
  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json({ ok: false, error: "No active business" }, { status: 400 });
  }

  let body: { leadId?: unknown; action?: unknown };
  try {
    body = (await req.json()) as { leadId?: unknown; action?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const leadId = body?.leadId;
  const action = body?.action;
  if (typeof leadId !== "string" || !leadId) {
    return NextResponse.json({ ok: false, error: "leadId (string) required" }, { status: 400 });
  }
  if (action !== "send" && action !== "confirm") {
    return NextResponse.json(
      { ok: false, error: "action must be 'send' or 'confirm'" },
      { status: 400 }
    );
  }

  try {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId: business.id } });
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }
    if (lead.consentStatus === "OPTED_OUT") {
      return NextResponse.json(
        { ok: false, error: "Lead has opted out — cannot re-consent." },
        { status: 409 }
      );
    }

    if (action === "send") {
      const messageBody = reconsentMessage(business.name);
      const result = await sendSms({
        to: lead.phone,
        from: business.fromNumber,
        body: messageBody,
      });
      // Log only — do NOT change consent or grant SMS eligibility here.
      await prisma.complianceEvent.create({
        data: {
          businessId: business.id,
          leadId: lead.id,
          type: "RECONSENT_SENT",
          detail: `Operator-sent re-consent request (one-off, pre-automation) [${result.mode}]: "${messageBody}"`,
        },
      });
      return NextResponse.json({ ok: true, mode: result.mode, sent: result.ok });
    }

    // action === "confirm": lead replied YES.
    const consentStatus = "RECONSENTED" as const;
    const smsEligible = isSmsEligible({
      consentStatus,
      dncStatus: lead.dncStatus,
      reassignedStatus: lead.reassignedStatus,
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        consentStatus,
        consentSource: "SMS re-consent (YES)",
        consentChannel: "sms",
        consentTimestamp: new Date(),
        smsEligible,
      },
    });
    await prisma.complianceEvent.create({
      data: {
        businessId: business.id,
        leadId: lead.id,
        type: "RECONSENT_CONFIRMED",
        detail: "Customer replied YES to operator-sent re-consent request.",
      },
    });
    return NextResponse.json({ ok: true, smsEligible });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Re-consent action failed", detail: String(err) },
      { status: 500 }
    );
  }
}

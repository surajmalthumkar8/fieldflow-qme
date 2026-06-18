import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/session";
import { runBrain } from "@/lib/ai/brain";
import { reserveSlot } from "@/lib/integrations";
import { isHighTicket } from "@/lib/config";
import type { BrainTurn } from "@/lib/types";

// Interactive "test the SMS qualifier" chat turn. Mirrors the voice route but
// runs the brain in REACTIVATION mode over an SMS (INBOUND) conversation so the
// team can text the AI live and watch it qualify + book — or honor STOP.
export async function POST(req: Request) {
  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json({ ok: false, error: "No active business" }, { status: 400 });
  }

  let body: { conversationId?: string; history?: BrainTurn[]; userMessage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const userMessage = (body.userMessage ?? "").trim();
  if (!userMessage) {
    return NextResponse.json({ ok: false, error: "userMessage required" }, { status: 400 });
  }
  const history: BrainTurn[] = Array.isArray(body.history) ? body.history : [];

  try {
  // Find or create the SMS conversation (inbound demo thread).
  let conversation = body.conversationId
    ? await prisma.conversation.findFirst({
        where: { id: body.conversationId, businessId: business.id },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        businessId: business.id,
        channel: "SMS",
        direction: "INBOUND",
        status: "ACTIVE",
        outcome: "",
        summary: "Interactive SMS qualifier demo",
      },
    });
  }

  // Persist the customer's inbound message.
  await prisma.message.create({
    data: { conversationId: conversation.id, role: "USER", content: userMessage },
  });

  const result = await runBrain({
    business,
    mode: "reactivation",
    history,
    userMessage,
  });

  // Persist the AI reply.
  await prisma.message.create({
    data: { conversationId: conversation.id, role: "ASSISTANT", content: result.reply },
  });

  let booking: { id: string; service: string; estimatedValue: number; isHighTicket: boolean } | null =
    null;
  let outcome = conversation.outcome || "";
  let status = conversation.status;

  if (result.action.type === "book") {
    const rawValue = result.action.estimatedValue ?? midpointHighTicketValue(business);
    const estimatedValue = rawValue > 0 ? rawValue : midpointHighTicketValue(business);
    const slot = await reserveSlot({ preferredTime: result.action.preferredTime });
    // conversationId is @unique on Booking — reuse any existing booking instead
    // of crashing on a second "book" action in the same thread.
    const existing = await prisma.booking.findUnique({
      where: { conversationId: conversation.id },
    });
    const created =
      existing ??
      (await prisma.booking.create({
        data: {
          businessId: business.id,
          conversationId: conversation.id,
          service: result.action.service ?? "Service visit",
          jobType: result.action.jobType ?? result.action.service ?? "Service visit",
          estimatedValue,
          isHighTicket: isHighTicket(estimatedValue),
          source: "REACTIVATION",
          scheduledAt: slot.scheduledAt,
          status: "BOOKED",
          remindersSent: 1,
        },
      }));
    booking = {
      id: created.id,
      service: created.service,
      estimatedValue: created.estimatedValue,
      isHighTicket: created.isHighTicket,
    };
    outcome = "BOOKED";
    status = "COMPLETED";
  } else if (result.action.type === "opt_out") {
    outcome = "OPTED_OUT";
    status = "COMPLETED";
    await prisma.complianceEvent.create({
      data: {
        businessId: business.id,
        type: "OPT_OUT",
        detail: "STOP received in interactive SMS qualifier demo.",
      },
    });
  } else if (result.action.type === "escalate") {
    outcome = "ESCALATED";
    status = "ESCALATED";
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      qualified: result.qualified,
      outcome,
      status,
      sentiment: result.sentiment ?? "neutral",
      outcomeReason: result.reason ?? "",
    },
  });

  return NextResponse.json({
    ok: true,
    conversationId: conversation.id,
    reply: result.reply,
    action: result.action,
    qualified: result.qualified,
    engine: result.engine,
    booking,
  });
  } catch (err) {
    console.error("[/api/sms] error:", err);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

// HVAC replacement / roofing midpoint when the brain doesn't return a value.
function midpointHighTicketValue(business: {
  services: string;
  avgJobValue: number;
}): number {
  try {
    const services = JSON.parse(business.services) as {
      priceLow: number;
      priceHigh: number;
      highTicket?: boolean;
    }[];
    const ht = services.find((s) => s.highTicket) ?? services[0];
    if (ht) return Math.round((ht.priceLow + ht.priceHigh) / 2);
  } catch {
    // fall through
  }
  return business.avgJobValue || 9500;
}

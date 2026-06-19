import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/session";
import { runBrain } from "@/lib/ai/brain";
import { reserveSlot } from "@/lib/integrations";
import { isHighTicket, parseBusiness } from "@/lib/config";
import type { BrainTurn } from "@/lib/types";

// Simulate inbound replies to a launched reactivation campaign. A realistic
// ~35% of launched-but-not-yet-replied conversations reply; replies vary
// across interested / not-now / STOP. Interested ones that the brain books
// create a Booking (REACTIVATION); ~half of booked are marked HELD with revenue
// in the past so the attribution dashboard has real proof to show. STOP replies
// flip the lead to OPTED_OUT (+ smsEligible=false) and log the opt-out event.

const INTERESTED = [
  "Yeah actually our AC has been struggling, can someone come take a look?",
  "Hey yes — we've been meaning to get the furnace checked before winter.",
  "Sure, that would be great. The system is pretty old.",
  "Yes please, the upstairs unit isn't keeping up at all.",
  "We've actually been thinking about replacing the whole system — yes.",
];
const NOT_NOW = [
  "Thanks but we're good for now.",
  "Not right now, maybe later in the year.",
  "Appreciate it, no thanks.",
];
const STOP_REPLIES = ["STOP", "Please stop texting me", "Unsubscribe"];

// Deterministic-ish but varied pick using the conversation id.
function pick<T>(arr: T[], seed: string, salt: number): T {
  let h = salt;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

export async function POST() {
  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json({ ok: false, error: "No active business" }, { status: 400 });
  }

  try {
  // Launched conversations with no inbound USER reply yet.
  const launched = await prisma.conversation.findMany({
    where: {
      businessId: business.id,
      channel: "SMS",
      direction: "OUTBOUND",
      summary: "Reactivation campaign",
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  const noReplyYet = launched.filter(
    (c) => !c.messages.some((m) => m.role === "USER")
  );

  const { services } = parseBusiness(business);
  const htService = services.find((s) => s.highTicket) ?? services[0];
  const htMidpoint = htService
    ? Math.round((htService.priceLow + htService.priceHigh) / 2)
    : business.avgJobValue || 9500;

  let replies = 0;
  let booked = 0;
  let optedOut = 0;
  let bookedSoFar = 0;

  for (const conv of noReplyYet) {
    // ~35% reply.
    const replyRoll = (Math.abs(hashStr(conv.id)) % 100) / 100;
    if (replyRoll > 0.37) continue;

    // Reply mix: ~12% STOP, ~55% interested, rest not-now.
    const mixRoll = (Math.abs(hashStr(conv.id + "mix")) % 100) / 100;
    let customerText: string;
    let kind: "interested" | "not_now" | "stop";
    if (mixRoll < 0.12) {
      customerText = pick(STOP_REPLIES, conv.id, 7);
      kind = "stop";
    } else if (mixRoll < 0.67) {
      customerText = pick(INTERESTED, conv.id, 3);
      kind = "interested";
    } else {
      customerText = pick(NOT_NOW, conv.id, 5);
      kind = "not_now";
    }

    // Persist the inbound reply.
    await prisma.message.create({
      data: { conversationId: conv.id, role: "USER", content: customerText },
    });
    replies++;

    const history: BrainTurn[] = conv.messages.map((m) => ({
      role: m.role === "ASSISTANT" ? "assistant" : "user",
      content: m.content,
    }));

    const result = await runBrain({
      business,
      mode: "reactivation",
      history,
      userMessage: customerText,
    });

    await prisma.message.create({
      data: { conversationId: conv.id, role: "ASSISTANT", content: result.reply },
    });

    if (kind === "stop" || result.action.type === "opt_out") {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { outcome: "OPTED_OUT", status: "COMPLETED", qualified: false },
      });
      if (conv.leadId) {
        await prisma.lead.update({
          where: { id: conv.leadId },
          data: { consentStatus: "OPTED_OUT", smsEligible: false },
        });
        await prisma.complianceEvent.create({
          data: {
            businessId: business.id,
            leadId: conv.leadId,
            type: "OPT_OUT",
            detail: "Replied STOP to reactivation campaign — suppressed permanently.",
          },
        });
      }
      optedOut++;
      continue;
    }

    if (kind === "not_now") {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { outcome: "NOT_INTERESTED", status: "COMPLETED", qualified: false },
      });
      continue;
    }

    // Interested: book it. Use the brain's action value (only if > 0) or the
    // high-ticket midpoint fallback — a HELD booking must never have $0 revenue.
    const rawValue = result.action.estimatedValue ?? 0;
    const estimatedValue =
      rawValue > 0 ? rawValue : htMidpoint > 0 ? htMidpoint : business.avgJobValue || 9500;
    const highTicket = isHighTicket(estimatedValue);
    const slot = await reserveSlot({ preferredTime: result.action.preferredTime });

    // ~half of booked jobs are already HELD (customer showed) with revenue, dated
    // in the recent past — this feeds the attribution dashboard with proof.
    const heldRoll = (Math.abs(hashStr(conv.id + "held")) % 100) / 100;
    const isHeld = bookedSoFar % 2 === 0 ? heldRoll < 0.6 : heldRoll < 0.4;
    const daysAgo = 1 + (Math.abs(hashStr(conv.id + "day")) % 25);
    const heldAt = new Date(Date.now() - daysAgo * 24 * 3600_000);

    await prisma.booking.create({
      data: {
        businessId: business.id,
        leadId: conv.leadId,
        conversationId: conv.id,
        service: result.action.service ?? htService?.name ?? "Service visit",
        jobType:
          result.action.jobType ?? result.action.service ?? htService?.name ?? "Service visit",
        estimatedValue,
        isHighTicket: highTicket,
        source: "REACTIVATION",
        scheduledAt: slot.scheduledAt,
        status: isHeld ? "HELD" : "BOOKED",
        heldAt: isHeld ? heldAt : null,
        revenue: isHeld ? estimatedValue : 0,
        // Per-held-appt kicker applies only to held high-ticket ($5k+) jobs on
        // clients with a kicker rate configured (roofing / HVAC replacement).
        kickerCharged: isHeld && highTicket && business.kickerPerAppt > 0,
      },
    });

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { outcome: "BOOKED", status: "COMPLETED", qualified: true },
    });
    booked++;
    bookedSoFar++;
  }

  return NextResponse.json({ ok: true, replies, booked, optedOut });
  } catch (err) {
    console.error("[reactivation/simulate-replies] failed:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to simulate replies" },
      { status: 500 }
    );
  }
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

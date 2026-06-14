import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runBrain } from "@/lib/ai/brain";
import { parseBusiness, isHighTicket } from "@/lib/config";
import { reserveSlot } from "@/lib/integrations";
import type { BrainTurn } from "@/lib/types";

export const dynamic = "force-dynamic";

interface VoiceRequestBody {
  businessId?: string;
  conversationId?: string;
  history?: BrainTurn[];
  userMessage?: string;
}

const START_SENTINEL = "__start__";

function isStart(userMessage: string): boolean {
  return userMessage.trim() === "" || userMessage.trim() === START_SENTINEL;
}

/**
 * The live, in-browser AI receptionist. POST a turn, get the AI's reply +
 * a structured action. We persist the conversation transcript and, when the
 * brain decides to book, create the attributed Booking row that shows up on
 * the dashboard. Runs end-to-end with no API keys (demo brain) and no mic
 * (text input) — the route never branches on either.
 */
export async function POST(req: Request) {
  let body: VoiceRequestBody;
  try {
    body = (await req.json()) as VoiceRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const businessId = body.businessId;
  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  try {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const history: BrainTurn[] = Array.isArray(body.history)
    ? body.history
        .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
        .map((t) => ({ role: t.role, content: t.content }))
    : [];
  const rawUserMessage = typeof body.userMessage === "string" ? body.userMessage : "";
  const start = isStart(rawUserMessage);
  // For the opening greeting turn we still call the brain (it greets) but pass
  // an empty user message and do NOT persist an empty USER message.
  const userMessage = start ? "" : rawUserMessage.trim();

  if (!start && !userMessage) {
    return NextResponse.json({ error: "userMessage required" }, { status: 400 });
  }

  const result = await runBrain({
    business,
    mode: "receptionist",
    history,
    userMessage,
  });

  // ---- Persist the conversation + transcript --------------------------------
  let conversationId = body.conversationId;
  if (!conversationId) {
    const convo = await prisma.conversation.create({
      data: {
        businessId: business.id,
        channel: "VOICE",
        direction: "INBOUND",
        status: "ACTIVE",
        summary: "Live AI receptionist demo call",
      },
    });
    conversationId = convo.id;
  }

  // Store the USER turn (skip on the opening greeting — no user input yet).
  if (userMessage) {
    await prisma.message.create({
      data: { conversationId, role: "USER", content: userMessage },
    });
  }
  // Always store the ASSISTANT reply.
  await prisma.message.create({
    data: { conversationId, role: "ASSISTANT", content: result.reply },
  });

  // ---- Apply the brain's action ---------------------------------------------
  const action = result.action;
  let bookingPayload:
    | {
        service: string;
        estimatedValue: number;
        scheduledAt: string;
        status: string;
        isHighTicket: boolean;
      }
    | undefined;

  // Defaults applied to the conversation; the action branches override them.
  const convoUpdate: {
    qualified: boolean;
    summary: string;
    sentiment: string;
    outcomeReason: string;
    status?: string;
    outcome?: string;
  } = {
    qualified: result.qualified,
    sentiment: result.sentiment ?? "neutral",
    outcomeReason: result.reason ?? "",
    summary: userMessage
      ? userMessage.slice(0, 180)
      : "Live AI receptionist demo call",
  };

  if (action.type === "book") {
    const { services } = parseBusiness(business);
    // estimatedValue precedence: action → matched service midpoint → avgJobValue.
    let estimatedValue = action.estimatedValue;
    if (typeof estimatedValue !== "number" || !estimatedValue) {
      const matched = services.find(
        (s) =>
          (action.service && s.name.toLowerCase() === action.service.toLowerCase()) ||
          (action.jobType && s.name.toLowerCase() === action.jobType.toLowerCase())
      );
      estimatedValue = matched
        ? Math.round((matched.priceLow + matched.priceHigh) / 2)
        : business.avgJobValue;
    }

    const slot = await reserveSlot({ preferredTime: action.preferredTime });
    const highTicket = isHighTicket(estimatedValue);
    const service = action.service || action.jobType || "Service visit";
    const jobType = action.jobType || action.service || "Service visit";

    // conversationId is @unique on Booking — the brain can emit "book" on more
    // than one turn, so only create once per call (reuse any existing booking).
    const existing = await prisma.booking.findUnique({ where: { conversationId } });
    const booking =
      existing ??
      (await prisma.booking.create({
        data: {
          businessId: business.id,
          conversationId,
          service,
          jobType,
          estimatedValue,
          isHighTicket: highTicket,
          source: "INBOUND_VOICE",
          scheduledAt: slot.scheduledAt,
          status: "BOOKED",
          remindersSent: 1, // confirmation text now; T-24h + T-2h reminders follow
        },
      }));

    convoUpdate.status = "COMPLETED";
    convoUpdate.outcome = "BOOKED";
    convoUpdate.qualified = true;

    bookingPayload = {
      service: booking.service,
      estimatedValue: booking.estimatedValue,
      scheduledAt: booking.scheduledAt.toISOString(),
      status: booking.status,
      isHighTicket: booking.isHighTicket,
    };
  } else if (action.type === "opt_out") {
    convoUpdate.status = "COMPLETED";
    convoUpdate.outcome = "OPTED_OUT";
  } else if (action.type === "escalate") {
    convoUpdate.status = "ESCALATED";
    convoUpdate.outcome = "ESCALATED";
  } else if (action.type === "callback") {
    convoUpdate.outcome = "CALLBACK";
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: convoUpdate,
  });

  return NextResponse.json({
    reply: result.reply,
    action: result.action,
    qualified: result.qualified,
    engine: result.engine,
    conversationId,
    booking: bookingPayload,
  });
  } catch (err) {
    console.error("[/api/voice] error:", err);
    return NextResponse.json({ error: "Something went wrong handling the call." }, { status: 500 });
  }
}

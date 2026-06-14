// The attribution engine — the CORE PRODUCT. Turns raw conversations + bookings
// into the funnel and ROI numbers the client pays for: call -> booked -> HELD -> $.

import type { Booking, Conversation } from "@prisma/client";

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
}

export interface AttributionSummary {
  // Funnel counts
  conversations: number;
  qualified: number;
  booked: number;
  confirmed: number;
  held: number;
  noShow: number;
  // Money
  recoveredRevenue: number; // sum of revenue on HELD jobs
  pipelineValue: number; // estimatedValue of booked-but-not-yet-held
  highTicketHeld: number;
  // Rates
  bookRate: number; // booked / conversations
  qualifyRate: number; // qualified / conversations
  holdRate: number; // held / (held + noShow)
  // ROI
  monthlyCost: number; // retainer + kicker charges
  kickerRevenue: number;
  roiMultiple: number; // recoveredRevenue / monthlyCost
  funnel: FunnelStage[];
  bySource: Record<string, { booked: number; held: number; revenue: number }>;
}

export function summarize(params: {
  conversations: Conversation[];
  bookings: Booking[];
  monthlyRetainer: number;
  kickerPerAppt: number;
}): AttributionSummary {
  const { conversations, bookings, monthlyRetainer, kickerPerAppt } = params;

  const totalConvos = conversations.length;
  const qualified = conversations.filter((c) => c.qualified).length;

  const booked = bookings.length;
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;
  const heldBookings = bookings.filter((b) => b.status === "HELD");
  const held = heldBookings.length;
  const noShow = bookings.filter((b) => b.status === "NO_SHOW").length;

  const recoveredRevenue = heldBookings.reduce((s, b) => s + (b.revenue || 0), 0);
  const pipelineValue = bookings
    .filter((b) => b.status === "BOOKED" || b.status === "CONFIRMED")
    .reduce((s, b) => s + (b.estimatedValue || 0), 0);
  const highTicketHeld = heldBookings.filter((b) => b.isHighTicket).length;

  const kickerRevenue = heldBookings.filter((b) => b.kickerCharged).length * kickerPerAppt;
  const monthlyCost = monthlyRetainer + kickerRevenue;

  const bySource: AttributionSummary["bySource"] = {};
  for (const b of bookings) {
    const k = b.source || "OTHER";
    bySource[k] ??= { booked: 0, held: 0, revenue: 0 };
    bySource[k].booked += 1;
    if (b.status === "HELD") {
      bySource[k].held += 1;
      bySource[k].revenue += b.revenue || 0;
    }
  }

  return {
    conversations: totalConvos,
    qualified,
    booked,
    confirmed,
    held,
    noShow,
    recoveredRevenue,
    pipelineValue,
    highTicketHeld,
    bookRate: totalConvos ? booked / totalConvos : 0,
    qualifyRate: totalConvos ? qualified / totalConvos : 0,
    holdRate: held + noShow ? held / (held + noShow) : 0,
    monthlyCost,
    kickerRevenue,
    roiMultiple: monthlyCost ? recoveredRevenue / monthlyCost : 0,
    funnel: [
      { key: "convos", label: "Conversations", value: totalConvos },
      { key: "qualified", label: "Qualified", value: qualified },
      { key: "booked", label: "Booked", value: booked },
      { key: "held", label: "Held (showed)", value: held },
    ],
    bySource,
  };
}

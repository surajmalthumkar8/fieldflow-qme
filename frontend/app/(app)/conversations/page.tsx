import { CalendarCheck, CheckCircle2, MessagesSquare } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/session";
import { pct } from "@/lib/format";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import {
  ConversationsTable,
  type ConversationRow,
} from "@/components/conversations/ConversationsTable";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Conversations"
          description="Every AI call and text transcript, with outcomes."
        />
        <EmptyState
          icon={<MessagesSquare className="h-8 w-8" />}
          title="No business configured yet"
          description="Run `npm run setup` to seed the demo data, then reload this page."
        />
      </div>
    );
  }

  const conversations = await prisma.conversation.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { firstName: true, lastName: true } },
      booking: { select: { id: true } },
    },
  });

  const rows: ConversationRow[] = conversations.map((c) => ({
    id: c.id,
    channel: c.channel,
    direction: c.direction,
    outcome: c.outcome,
    qualified: c.qualified,
    durationSec: c.durationSec,
    summary: c.summary,
    sentiment: c.sentiment,
    leadName: c.lead
      ? `${c.lead.firstName} ${c.lead.lastName}`.trim() || "Unknown caller"
      : "Unknown caller",
    hasBooking: Boolean(c.booking),
    createdAt: c.createdAt.toISOString(),
  }));

  const total = rows.length;
  const qualified = rows.filter((r) => r.qualified).length;
  const booked = rows.filter((r) => r.outcome === "BOOKED").length;
  const qualifyRate = total > 0 ? qualified / total : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversations"
        description="Every recorded AI call and text — the evidence behind every booked job."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Conversations"
          value={total}
          sub="Calls + texts handled by the AI"
          tone="neutral"
          icon={<MessagesSquare className="h-4 w-4" />}
        />
        <StatCard
          label="Qualified rate"
          value={pct(qualifyRate)}
          sub={`${qualified} of ${total} qualified`}
          tone="signal"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Booked"
          value={booked}
          sub="Conversations that became an appointment"
          tone="money"
          icon={<CalendarCheck className="h-4 w-4" />}
        />
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<MessagesSquare className="h-7 w-7" />}
          title="No conversations yet"
          description="Once the AI answers a call or runs a reactivation text, transcripts appear here."
        />
      ) : (
        <ConversationsTable rows={rows} />
      )}
    </div>
  );
}

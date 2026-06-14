import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  MessageSquare,
  MessagesSquare,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/session";
import { usd } from "@/lib/format";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  SectionLabel,
} from "@/components/ui/primitives";
import {
  Transcript,
  type TranscriptMessage,
} from "@/components/conversations/Transcript";
import { SentimentBadge } from "@/components/conversations/SentimentBadge";
import { RecordingPlayer } from "@/components/conversations/RecordingPlayer";
import { ReminderCadence } from "@/components/conversations/ReminderCadence";
import {
  bookingStatusTone,
  fmtDateTime,
  fmtDuration,
  outcomeLabel,
  outcomeReasonLabel,
  outcomeReasonTone,
  outcomeTone,
} from "@/components/conversations/shared";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getActiveBusiness();

  const conversation = business
    ? await prisma.conversation.findFirst({
        where: { id, businessId: business.id },
        include: {
          lead: true,
          booking: true,
          messages: { orderBy: { createdAt: "asc" } },
        },
      })
    : null;

  if (!conversation) {
    return (
      <div className="space-y-6">
        <PageHeader title="Conversation" description="Transcript & outcome." />
        <EmptyState
          icon={<MessagesSquare className="h-8 w-8" />}
          title="Conversation not found"
          description="It may belong to another business, or the link is stale."
        />
        <Link
          href="/conversations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-signal-600 hover:text-signal-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to conversations
        </Link>
      </div>
    );
  }

  const isVoice = conversation.channel === "VOICE";
  const isInbound = conversation.direction === "INBOUND";
  const leadName = conversation.lead
    ? `${conversation.lead.firstName} ${conversation.lead.lastName}`.trim() ||
      "Unknown caller"
    : "Unknown caller";

  const messages: TranscriptMessage[] = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));

  const booking = conversation.booking;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/conversations"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Conversations
        </Link>
        <PageHeader
          title={leadName}
          description={`${isInbound ? "Inbound" : "Outbound"} ${
            isVoice ? "call" : "text thread"
          } handled by the AI receptionist.`}
        >
          <Badge tone={isVoice ? "money" : "signal"}>
            {isVoice ? (
              <PhoneCall className="h-3.5 w-3.5" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5" />
            )}
            {isVoice ? "Voice" : "SMS"}
          </Badge>
          <SentimentBadge sentiment={conversation.sentiment} />
          <Badge tone={outcomeTone(conversation.outcome)}>
            {outcomeLabel(conversation.outcome)}
          </Badge>
        </PageHeader>
      </div>

      {/* AI call summary */}
      {conversation.summary ? (
        <Card className="border-l-4 border-l-signal-500 bg-signal-50/30">
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-signal-600" />
              <span className="eyebrow text-signal-600">AI call summary</span>
              {conversation.outcomeReason ? (
                <Badge tone={outcomeReasonTone(conversation.outcomeReason)}>
                  {outcomeReasonLabel(conversation.outcomeReason)}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed text-ink-800">{conversation.summary}</p>
          </CardBody>
        </Card>
      ) : null}

      {/* Recording player (voice only) */}
      {isVoice ? (
        <div className="space-y-3">
          <SectionLabel>Call recording</SectionLabel>
          <RecordingPlayer seed={conversation.id} durationSec={conversation.durationSec} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Transcript */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Transcript"
            subtitle={`${messages.length} turn${messages.length === 1 ? "" : "s"} · ${
              isInbound ? "inbound" : "outbound"
            } ${isVoice ? "call" : "text thread"}`}
          />
          <CardBody>
            <Transcript messages={messages} />
          </CardBody>
        </Card>

        {/* Side panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-3 text-sm">
              <Row label="Customer" value={leadName} />
              {conversation.lead?.phone ? (
                <Row label="Phone" value={conversation.lead.phone} mono />
              ) : null}
              {conversation.lead?.source ? (
                <Row label="Lead source" value={conversation.lead.source} />
              ) : null}
              <Row
                label="Channel"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    {isVoice ? (
                      <PhoneCall className="h-3.5 w-3.5 text-money-600" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 text-signal-600" />
                    )}
                    {isVoice ? "Voice" : "SMS"}
                  </span>
                }
              />
              <Row
                label="Direction"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    {isInbound ? (
                      <ArrowDownLeft className="h-3.5 w-3.5 text-money-500" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5 text-signal-500" />
                    )}
                    {isInbound ? "Inbound" : "Outbound"}
                  </span>
                }
              />
              <Row
                label="Outcome"
                value={
                  <Badge tone={outcomeTone(conversation.outcome)}>
                    {outcomeLabel(conversation.outcome)}
                  </Badge>
                }
              />
              {conversation.outcomeReason ? (
                <Row
                  label="Reason"
                  value={
                    <Badge tone={outcomeReasonTone(conversation.outcomeReason)}>
                      {outcomeReasonLabel(conversation.outcomeReason)}
                    </Badge>
                  }
                />
              ) : null}
              <Row
                label="Sentiment"
                value={<SentimentBadge sentiment={conversation.sentiment} />}
              />
              <Row
                label="Qualified"
                value={
                  conversation.qualified ? (
                    <span className="inline-flex items-center gap-1 text-money-700">
                      <CheckCircle2 className="h-4 w-4" /> Yes
                    </span>
                  ) : (
                    <span className="text-ink-400">No</span>
                  )
                }
              />
              {isVoice ? (
                <Row
                  label="Duration"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-ink-400" />
                      <span className="num">{fmtDuration(conversation.durationSec)}</span>
                    </span>
                  }
                />
              ) : null}
              <Row label="When" value={fmtDateTime(conversation.createdAt.toISOString())} />
            </CardBody>
          </Card>

          {/* Linked booking */}
          {booking ? (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-money-600" /> Booking
                  </span>
                }
                action={
                  <Badge tone={bookingStatusTone(booking.status)}>{booking.status}</Badge>
                }
              />
              <CardBody className="space-y-3 text-sm">
                <Row label="Service" value={booking.service || booking.jobType || "—"} />
                <Row
                  label="Estimated value"
                  value={<span className="num">{usd(booking.estimatedValue)}</span>}
                />
                {booking.isHighTicket ? (
                  <Row label="Tier" value={<Badge tone="money">High-ticket ($5k+)</Badge>} />
                ) : null}
                <Row label="Scheduled" value={fmtDateTime(booking.scheduledAt.toISOString())} />
                {booking.status === "HELD" ? (
                  <Row
                    label="Revenue (held)"
                    value={
                      <span className="num font-semibold text-money-700">
                        {usd(booking.revenue)}
                      </span>
                    }
                  />
                ) : null}
                {booking.heldAt ? (
                  <Row label="Held on" value={fmtDateTime(booking.heldAt.toISOString())} />
                ) : null}
                <div className="border-t border-ink-100 pt-4">
                  <p className="eyebrow mb-3">Reminder cadence</p>
                  <ReminderCadence remindersSent={booking.remindersSent} />
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-ink-400">{label}</span>
      <span
        className={
          mono
            ? "text-right font-mono text-xs text-ink-700"
            : "text-right font-medium text-ink-800"
        }
      >
        {value}
      </span>
    </div>
  );
}

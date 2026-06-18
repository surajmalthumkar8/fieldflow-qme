import {
  Activity,
  CheckCircle2,
  ExternalLink,
  PhoneCall,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/session";
import { summarize } from "@/lib/attribution";
import { usd, compactUsd, pct, tradeLabel } from "@/lib/format";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  SectionLabel,
  StatCard,
} from "@/components/ui/primitives";
import { Funnel } from "@/components/dashboard/Funnel";
import { RoiPanel } from "@/components/dashboard/RoiPanel";
import { SourceBars, type SourceDatum } from "@/components/dashboard/SourceBars";
import { RevenueTrend, type WeekDatum } from "@/components/dashboard/RevenueTrend";
import { CallFalloff, type FalloffDatum } from "@/components/dashboard/CallFalloff";
import { SentimentMix, type SentimentData } from "@/components/dashboard/SentimentMix";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  REACTIVATION: "Reactivation",
  INBOUND_VOICE: "Inbound voice",
  SPEED_TO_LEAD: "Speed to lead",
};

const SOURCE_TONE: Record<string, "signal" | "money" | "neutral"> = {
  REACTIVATION: "signal",
  INBOUND_VOICE: "money",
  SPEED_TO_LEAD: "neutral",
};

// Industry book-rate context (Netic / Avoca publish ~60–70% qualified-to-booked
// on engaged inbound). Framing our rate against it makes the number credible.
const BOOK_BENCHMARK_LOW = 0.6;
const BOOK_BENCHMARK_HIGH = 0.7;

// Why non-booked conversations fall off — labels + the action each bucket implies.
const FALLOFF_META: Record<string, { label: string; action: string }> = {
  not_interested: {
    label: "Not interested",
    action: "Genuinely out of market — protect spend, don't re-touch.",
  },
  info_only: {
    label: "Info only",
    action: "Answered the question; nurture for a future job.",
  },
  needs_human: {
    label: "Needs a human",
    action: "Routed to your team — tighten escalation so none slip.",
  },
  out_of_area: {
    label: "Out of area",
    action: "Outside service area — a clean disqualify, not a loss.",
  },
  pricing: {
    label: "Price-shopping",
    action: "Price-sensitive — a follow-up offer can still convert.",
  },
};
const FALLOFF_ORDER = ["not_interested", "info_only", "needs_human", "out_of_area", "pricing"];

function sourceLabel(s: string): string {
  return SOURCE_LABELS[s] ?? s.replace(/_/g, " ").toLowerCase();
}

export default async function DashboardPage() {
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Attribution"
          description="Every call and text → booked → held → dollars. This is what you pay for."
        />
        <EmptyState
          icon={<Activity className="h-8 w-8" />}
          title="No business configured yet"
          description="Run `npm run setup` to seed the demo data, then reload this page."
        />
      </div>
    );
  }

  const [conversations, bookings] = await Promise.all([
    prisma.conversation.findMany({ where: { businessId: business.id } }),
    prisma.booking.findMany({ where: { businessId: business.id } }),
  ]);

  const summary = summarize({
    conversations,
    bookings,
    monthlyRetainer: business.monthlyRetainer,
    kickerPerAppt: business.kickerPerAppt,
  });

  // Revenue by source (friendly labels + only the sources that exist).
  const sourceData: SourceDatum[] = Object.entries(summary.bySource)
    .map(([source, v]) => ({
      source: sourceLabel(source),
      booked: v.booked,
      held: v.held,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Weekly held-revenue trend over the last ~8 weeks (computed server-side;
  // pass plain strings/numbers to the client chart).
  const weeklyTrend = buildWeeklyTrend(bookings);

  // --- New competitor-informed aggregates (all server-side, serializable) ---

  // "Where calls fall off": group non-booked conversations by outcomeReason.
  const bookedConvoIds = new Set(
    bookings.map((b) => b.conversationId).filter(Boolean) as string[]
  );
  const falloffCounts: Record<string, number> = {};
  for (const c of conversations) {
    const isBooked =
      c.outcomeReason === "booked" || bookedConvoIds.has(c.id) || c.outcome === "BOOKED";
    if (isBooked) continue;
    const reason = c.outcomeReason && c.outcomeReason !== "booked" ? c.outcomeReason : "info_only";
    falloffCounts[reason] = (falloffCounts[reason] ?? 0) + 1;
  }
  const falloffData: FalloffDatum[] = FALLOFF_ORDER.filter(
    (k) => (falloffCounts[k] ?? 0) > 0
  ).map((k) => ({
    key: k,
    label: FALLOFF_META[k].label,
    value: falloffCounts[k],
    action: FALLOFF_META[k].action,
  }));

  // Sentiment mix across all conversations.
  const sentiment: SentimentData = {
    positive: conversations.filter((c) => c.sentiment === "positive").length,
    neutral: conversations.filter((c) => c.sentiment === "neutral").length,
    negative: conversations.filter((c) => c.sentiment === "negative").length,
  };

  // Hold-rate context: average reminder touches across booked appts (the
  // 3-touch confirm/reminder cadence that protects show-rate).
  const reminderBookings = bookings.filter(
    (b) => b.status === "HELD" || b.status === "NO_SHOW" || b.status === "CONFIRMED"
  );
  const avgReminders = reminderBookings.length
    ? reminderBookings.reduce((s, b) => s + (b.remindersSent ?? 0), 0) /
      reminderBookings.length
    : 0;

  const beatsBenchmark = summary.bookRate > BOOK_BENCHMARK_HIGH;

  // Recent held high-ticket jobs — the proof asset / "case study" table.
  const heldRows = await prisma.booking.findMany({
    where: { businessId: business.id, status: "HELD" },
    orderBy: { heldAt: "desc" },
    take: 12,
    include: {
      lead: { select: { firstName: true, lastName: true } },
      conversation: { select: { recordingUrl: true, channel: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attribution"
        description="Every call and text → booked → held → dollars. This is what you pay for."
      >
        <Badge tone="signal">{business.name}</Badge>
        <Badge tone="neutral">{tradeLabel(business.trade)}</Badge>
      </PageHeader>

      {/* Hero KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Recovered revenue"
          value={usd(summary.recoveredRevenue)}
          sub="Closed value of held jobs"
          tone="money"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Return multiple"
          value={`${summary.roiMultiple.toFixed(1)}×`}
          sub={`vs ${usd(summary.monthlyCost)}/mo`}
          tone="signal"
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Held jobs"
          value={summary.held}
          sub={`${summary.highTicketHeld} high-ticket ($5k+)`}
          tone="money"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Booked"
          value={summary.booked}
          sub={`${compactUsd(summary.pipelineValue)} not-yet-held pipeline`}
          tone="neutral"
          icon={<PhoneCall className="h-4 w-4" />}
        />
      </div>

      {/* Funnel + ROI */}
      <SectionLabel>Conversation economics</SectionLabel>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Conversation → held funnel"
            subtitle="How many AI conversations turn into a held, paying job"
          />
          <CardBody>
            <Funnel stages={summary.funnel} />
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-100 pt-4 text-center">
              <FunnelStat label="Qualify rate" value={pct(summary.qualifyRate)} />
              <FunnelStat
                label="Book rate"
                value={pct(summary.bookRate)}
                benchmark={beatsBenchmark}
              />
              <FunnelStat label="Hold rate" value={pct(summary.holdRate)} />
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] text-ink-400">
              <span>
                Book rate vs{" "}
                <span className="num font-medium text-ink-500">
                  ~{pct(BOOK_BENCHMARK_LOW)}–{pct(BOOK_BENCHMARK_HIGH)}
                </span>{" "}
                industry average for engaged inbound
              </span>
              {beatsBenchmark ? (
                <Badge tone="flare">Above benchmark</Badge>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Did it pay for itself?"
            subtitle="Monthly fee vs. revenue we recovered"
          />
          <CardBody>
            <RoiPanel
              monthlyCost={summary.monthlyCost}
              recoveredRevenue={summary.recoveredRevenue}
              roiMultiple={summary.roiMultiple}
            />
          </CardBody>
        </Card>
      </div>

      {/* Hold-rate + reminder cadence, then fall-off + sentiment */}
      <SectionLabel>Quality &amp; protection</SectionLabel>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Held rate"
            subtitle="Booked jobs that actually showed"
          />
          <CardBody className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="num text-4xl font-semibold text-money-600">
                {pct(summary.holdRate)}
              </span>
              <span className="text-sm text-ink-500">
                {summary.held} held / {summary.noShow} no-show
              </span>
            </div>
            <div className="rounded-xl border border-ink-100 bg-paper-50 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-money-600" />
                <span className="text-xs font-semibold text-ink-700">
                  3-touch SMS reminder cadence
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-ink-500">
                Averaging{" "}
                <span className="num font-semibold text-ink-700">
                  {avgReminders.toFixed(1)}
                </span>{" "}
                of 3 confirm/reminder touches per appointment — that cadence is
                what protects the held rate from no-shows.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Where calls fall off"
            subtitle="Why non-booked conversations didn't convert — turn losses into buckets"
          />
          <CardBody>
            <CallFalloff data={falloffData} />
          </CardBody>
        </Card>
      </div>

      {/* Revenue by source + sentiment */}
      <SectionLabel>Channels &amp; experience</SectionLabel>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recovered revenue by source"
            subtitle="Reactivation is the onboarding win; inbound is the durable engine"
          />
          <CardBody>
            <SourceBars data={sourceData} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Caller sentiment"
            subtitle="How people feel leaving the AI conversation"
          />
          <CardBody className="pt-2">
            <SentimentMix data={sentiment} />
          </CardBody>
        </Card>
      </div>

      {/* Held revenue trend */}
      <Card>
        <CardHeader
          title="Held revenue trend"
          subtitle="Closed-job value per week"
        />
        <CardBody>
          <RevenueTrend data={weeklyTrend} />
        </CardBody>
      </Card>

      {/* Recent held high-ticket jobs — the proof asset */}
      <SectionLabel>Recorded proof</SectionLabel>
      <Card>
        <CardHeader
          title="Recent held jobs"
          subtitle="Recorded, attributed proof — the case study you can show anyone"
          action={
            <Badge tone="money">{usd(summary.recoveredRevenue)} recovered</Badge>
          }
        />
        <CardBody className="pt-0">
          {heldRows.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-7 w-7" />}
              title="No held jobs yet"
              description="Booked jobs appear here once the customer shows and the work is logged."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="py-2 pr-4 font-medium">Customer</th>
                    <th className="py-2 pr-4 font-medium">Service</th>
                    <th className="py-2 pr-4 text-right font-medium">Est. value</th>
                    <th className="py-2 pr-4 text-right font-medium">Revenue (held)</th>
                    <th className="py-2 pr-4 font-medium">Held</th>
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-0 font-medium">Recording</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {heldRows.map((b) => {
                    const name = b.lead
                      ? `${b.lead.firstName} ${b.lead.lastName}`.trim()
                      : "—";
                    const rec = b.conversation?.recordingUrl;
                    return (
                      <tr key={b.id} className="text-ink-700 hover:bg-ink-50/60">
                        <td className="py-3 pr-4 font-medium text-ink-900">
                          <span className="flex items-center gap-2">
                            {name || "—"}
                            {b.isHighTicket ? (
                              <Badge tone="money">High-ticket</Badge>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {b.jobType || b.service || "—"}
                        </td>
                        <td className="num py-3 pr-4 text-right text-ink-500">
                          {usd(b.estimatedValue)}
                        </td>
                        <td className="num py-3 pr-4 text-right font-semibold text-money-700">
                          {usd(b.revenue)}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-ink-500">
                          {b.heldAt ? fmtDate(b.heldAt) : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone={SOURCE_TONE[b.source] ?? "neutral"}>
                            {sourceLabel(b.source)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-0">
                          {rec ? (
                            <a
                              href={rec}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-signal-600 hover:text-signal-700 hover:underline"
                            >
                              Listen
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-ink-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function FunnelStat({
  label,
  value,
  benchmark,
}: {
  label: string;
  value: string;
  benchmark?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5">
        <span className="num text-lg font-semibold text-ink-900">{value}</span>
        {benchmark ? (
          <Badge tone="money" className="px-1.5 py-0">
            ↑
          </Badge>
        ) : null}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

// Group held bookings into the last 8 calendar weeks by heldAt, summing
// revenue. Returns ascending-by-time data with friendly week labels.
function buildWeeklyTrend(
  bookings: { status: string; heldAt: Date | null; revenue: number }[]
): WeekDatum[] {
  const WEEKS = 8;
  const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  // Anchor to the start (Monday-ish) of the current week — use UTC midnight of today.
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end.getTime() - (WEEKS - 1) * MS_WEEK);

  const buckets: WeekDatum[] = [];
  for (let i = 0; i < WEEKS; i++) {
    const weekStart = new Date(start.getTime() + i * MS_WEEK);
    buckets.push({
      week: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(weekStart),
      revenue: 0,
    });
  }

  for (const b of bookings) {
    if (b.status !== "HELD" || !b.heldAt) continue;
    const idx = Math.floor((b.heldAt.getTime() - start.getTime()) / MS_WEEK);
    if (idx >= 0 && idx < WEEKS) buckets[idx].revenue += b.revenue || 0;
  }

  return buckets;
}

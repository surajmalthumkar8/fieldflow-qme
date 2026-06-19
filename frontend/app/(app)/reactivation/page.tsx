import Link from "next/link";
import {
  Send,
  ShieldCheck,
  CheckCircle2,
  UserX,
  MessageSquare,
  CalendarCheck2,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/session";
import { DISCLOSURES } from "@/lib/compliance";
import { usd } from "@/lib/format";
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
import { CampaignComposer } from "@/components/reactivation/CampaignComposer";
import { SmsQualifierChat } from "@/components/reactivation/SmsQualifierChat";

export const dynamic = "force-dynamic";

export default async function ReactivationPage() {
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Reactivation"
          description="Text the client's own consented dormant list and book the replies."
        />
        <EmptyState
          icon={<Send className="h-8 w-8" />}
          title="No business configured yet"
          description="Run `npm run setup` to seed the demo data, then reload."
        />
      </div>
    );
  }

  const [eligible, blocked, optedOut, totalLeads, outboundConvos, reactivationBookings] =
    await Promise.all([
      prisma.lead.count({ where: { businessId: business.id, smsEligible: true } }),
      prisma.lead.count({
        where: {
          businessId: business.id,
          smsEligible: false,
          consentStatus: { not: "OPTED_OUT" },
        },
      }),
      prisma.lead.count({
        where: { businessId: business.id, consentStatus: "OPTED_OUT" },
      }),
      prisma.lead.count({ where: { businessId: business.id } }),
      prisma.conversation.findMany({
        where: {
          businessId: business.id,
          channel: "SMS",
          direction: "OUTBOUND",
          summary: "Reactivation campaign",
        },
        select: { id: true, outcome: true, leadId: true, messages: { select: { role: true } } },
      }),
      prisma.booking.findMany({
        where: { businessId: business.id, source: "REACTIVATION" },
        select: { status: true, revenue: true, estimatedValue: true },
      }),
    ]);

  // Campaign rollups.
  const sent = outboundConvos.length;
  const launchedLeadIds = new Set(outboundConvos.map((c) => c.leadId).filter(Boolean));
  const unsentCount = Math.max(0, eligible - launchedLeadIds.size);
  const replied = outboundConvos.filter((c) =>
    c.messages.some((m) => m.role === "USER")
  ).length;
  const campaignBooked = outboundConvos.filter((c) => c.outcome === "BOOKED").length;
  const campaignOptedOut = outboundConvos.filter((c) => c.outcome === "OPTED_OUT").length;
  const heldRevenue = reactivationBookings
    .filter((b) => b.status === "HELD")
    .reduce((sum, b) => sum + (b.revenue || 0), 0);
  const pipelineValue = reactivationBookings
    .filter((b) => b.status === "BOOKED")
    .reduce((sum, b) => sum + (b.estimatedValue || 0), 0);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Reactivation"
        description="The pilot hook: text the client's own consented dormant list (Claude-written) and book the replies. A one-time recovery 'sugar high' that proves ROI fast."
      >
        <Badge tone="signal">{business.name}</Badge>
      </PageHeader>

      {/* Consent gate banner */}
      <Card
        className={
          blocked > 0
            ? "border-warn-400/40 bg-warn-50/40"
            : "border-money-400/30 bg-money-50/30"
        }
      >
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={blocked > 0 ? "text-warn-600" : "text-money-600"}>
              {blocked > 0 ? (
                <AlertTriangle className="mt-0.5 h-5 w-5" />
              ) : (
                <ShieldCheck className="mt-0.5 h-5 w-5" />
              )}
            </span>
            <div className="text-sm">
              <p className="font-semibold text-ink-900">
                Only SMS-eligible leads (written consent + DNC/Reassigned scrubbed) are messageable.
              </p>
              <p className="mt-0.5 text-ink-600">
                {blocked > 0 ? (
                  <>
                    <span className="font-semibold text-warn-700">
                      <span className="num">{blocked}</span> lead{blocked === 1 ? " is" : "s are"} blocked
                    </span>{" "}
                    — resolve them in Compliance. Blocked and opted-out leads are never messaged.
                  </>
                ) : (
                  <>All eligible leads are scrubbed and consented. Blocked leads are never messaged.</>
                )}
              </p>
            </div>
          </div>
          <Link
            href="/compliance"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-medium text-signal-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
          >
            Open Compliance
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardBody>
      </Card>

      {/* Lead posture */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="SMS-eligible"
          value={eligible}
          sub={`of ${totalLeads} on the list`}
          tone="money"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Blocked"
          value={blocked}
          sub="Need re-consent / scrub"
          tone={blocked > 0 ? "warn" : "neutral"}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Opted out"
          value={optedOut}
          sub="Suppressed permanently"
          tone={optedOut > 0 ? "danger" : "neutral"}
          icon={<UserX className="h-4 w-4" />}
        />
        <StatCard
          label="Already contacted"
          value={launchedLeadIds.size}
          sub={`${unsentCount} eligible not yet texted`}
          tone="signal"
          icon={<MessageSquare className="h-4 w-4" />}
        />
      </div>

      {eligible === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Send className="h-7 w-7" />}
              title="No SMS-eligible leads yet"
              description="Upload a list and run the re-consent gate + scrubs in Leads & Consent. Reactivation only ever messages a client's own, consented contacts."
            />
          </CardBody>
        </Card>
      ) : (
        <CampaignComposer
          eligibleCount={eligible}
          unsentCount={unsentCount}
          smsFooter={DISCLOSURES.smsFooter}
        />
      )}

      <SectionLabel>Campaign results</SectionLabel>

      {/* Campaign results */}
      <Card>
        <CardHeader
          title="Campaign results"
          subtitle="Reactivation messages → replies → booked → held revenue. Feeds the attribution dashboard."
          action={
            <div className="flex items-center gap-2 text-xs">
              <Link href="/conversations" className="font-medium text-signal-600 hover:underline">
                View conversations
              </Link>
              <span className="text-ink-300">·</span>
              <Link href="/dashboard" className="font-medium text-signal-600 hover:underline">
                Attribution
              </Link>
            </div>
          }
        />
        <CardBody>
          {sent === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-7 w-7" />}
              title="No campaign sent yet"
              description="Compose an opener above and launch it to your SMS-eligible leads, then simulate replies to see jobs book."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <ResultStat label="Messages sent" value={sent} icon={<Send className="h-4 w-4" />} />
              <ResultStat label="Replies" value={replied} icon={<MessageSquare className="h-4 w-4" />} />
              <ResultStat
                label="Booked"
                value={campaignBooked}
                tone="signal"
                icon={<CalendarCheck2 className="h-4 w-4" />}
              />
              <ResultStat
                label="Opted out"
                value={campaignOptedOut}
                tone="danger"
                icon={<UserX className="h-4 w-4" />}
              />
              <ResultStat
                label="Recovered"
                value={usd(heldRevenue)}
                tone="money"
                sub={pipelineValue > 0 ? `${usd(pipelineValue)} pipeline` : undefined}
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Interactive SMS qualifier demo */}
      <SmsQualifierChat businessName={business.name} />
    </div>
  );
}

function ResultStat({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "neutral" | "signal" | "money" | "danger";
  icon?: React.ReactNode;
}) {
  const accent: Record<string, string> = {
    neutral: "text-ink-900",
    signal: "text-signal-600",
    money: "text-money-600",
    danger: "text-danger-600",
  };
  return (
    <div className="rounded-xl border border-ink-200/80 bg-ink-50/40 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {icon}
        {label}
      </div>
      <div className={`num mt-1 text-xl font-semibold ${accent[tone]}`}>{value}</div>
      {sub ? <div className="text-[11px] text-ink-400">{sub}</div> : null}
    </div>
  );
}

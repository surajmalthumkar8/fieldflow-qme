import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  MessageSquareWarning,
  Mic,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/session";
import {
  A2P_STEPS,
  DISCLOSURES,
  TCPA_PENALTY_PER_MESSAGE,
} from "@/lib/compliance";
import type { A2PStatus, ConsentStatus } from "@/lib/types";
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
import { ScrubButton } from "@/components/leads/ScrubButton";
import { CONSENT_META } from "@/components/leads/consent";
import { AuditLog, type AuditRow } from "@/components/compliance/AuditLog";

export const dynamic = "force-dynamic";

const A2P_TONE: Record<A2PStatus, "money" | "warn" | "danger"> = {
  REGISTERED: "money",
  PENDING: "warn",
  NOT_STARTED: "danger",
};

const A2P_LABEL: Record<A2PStatus, string> = {
  REGISTERED: "Registered",
  PENDING: "Pending vetting",
  NOT_STARTED: "Not started",
};

const CONSENT_ORDER: ConsentStatus[] = [
  "WRITTEN",
  "RECONSENTED",
  "IMPLIED",
  "UNKNOWN",
  "OPTED_OUT",
];

export default async function CompliancePage() {
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Compliance"
          description="The moat: per-lead consent, scrubs, disclosures, and a 5-year audit trail."
        />
        <EmptyState
          icon={<ShieldCheck className="h-8 w-8" />}
          title="No business configured yet"
          description="Run `npm run setup` to seed the demo data, then reload this page."
        />
      </div>
    );
  }

  const [leads, events] = await Promise.all([
    prisma.lead.findMany({
      where: { businessId: business.id },
      select: {
        consentStatus: true,
        dncStatus: true,
        reassignedStatus: true,
        smsEligible: true,
      },
    }),
    prisma.complianceEvent.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const total = leads.length;
  const byConsent = Object.fromEntries(
    CONSENT_ORDER.map((c) => [c, leads.filter((l) => l.consentStatus === c).length])
  ) as Record<ConsentStatus, number>;

  const eligible = leads.filter((l) => l.smsEligible).length;
  const blocked = total - eligible;
  const onDnc = leads.filter((l) => l.dncStatus === "ON_DNC").length;
  const reassigned = leads.filter((l) => l.reassignedStatus === "REASSIGNED").length;
  const dncClear = leads.filter((l) => l.dncStatus === "CLEAR").length;
  const reassignedClear = leads.filter((l) => l.reassignedStatus === "CLEAR").length;

  // Hypothetical TCPA exposure if the blocked leads were messaged anyway.
  const exposureLow = blocked * TCPA_PENALTY_PER_MESSAGE.low;
  const exposureHigh = blocked * TCPA_PENALTY_PER_MESSAGE.high;

  const a2pStatus = business.a2pStatus as A2PStatus;

  const auditRows: AuditRow[] = events.map((e) => ({
    id: e.id,
    type: e.type,
    detail: e.detail,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Compliance"
        description="Compliance isn't overhead here — it's the product. Per-lead written consent, mandatory scrubs, hard-coded AI disclosures, and a 5-year audit trail are exactly what a co-sending agency is liable for."
      >
        <Badge tone="signal">{business.name}</Badge>
      </PageHeader>

      <SectionLabel>Consent gate</SectionLabel>

      {/* 1. Consent gate */}
      <Card>
        <CardHeader
          title="Consent gate"
          subtitle="Automated SMS / AI-voice marketing requires prior express WRITTEN consent (PEWC) per lead"
          action={
            <Badge tone={blocked === 0 ? "money" : "warn"}>
              <span className="num">{eligible}</span> eligible /{" "}
              <span className="num">{blocked}</span> blocked
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-warn-400/40 bg-warn-50 px-4 py-3 text-sm text-warn-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Existing business relationship gives ZERO cover</strong> for automated
              SMS/AI-voice marketing. Implied consent covers transactional/service messages only.
              Anything short of written consent is <strong>voice-only</strong> until re-consented.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {CONSENT_ORDER.map((c) => (
              <div
                key={c}
                className="rounded-xl border border-ink-200/70 bg-ink-50/40 px-3 py-3"
              >
                <div className="num text-2xl font-semibold text-ink-900">
                  {byConsent[c]}
                </div>
                <div className="mt-1">
                  <Badge tone={CONSENT_META[c].tone}>{CONSENT_META[c].label}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <SectionLabel>TCPA exposure</SectionLabel>

      {/* 2. TCPA exposure */}
      <Card>
        <CardHeader
          title="TCPA exposure"
          subtitle="You (the agency) are a co-sender — directly liable, with no aggregate cap"
          action={<MessageSquareWarning className="h-5 w-5 text-danger-500" />}
        />
        <CardBody className="space-y-4">
          <p className="text-sm text-ink-600">
            As the co-sender of every message, the agency is jointly liable at{" "}
            <strong className="num text-danger-700">
              {usd(TCPA_PENALTY_PER_MESSAGE.low)}–{usd(TCPA_PENALTY_PER_MESSAGE.high)}
            </strong>{" "}
            <strong>per message</strong>, with no aggregate cap. That liability is exactly why the
            consent gate and scrubs are non-negotiable.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Blocked leads"
              value={blocked}
              sub="Would be unlawful to text now"
              tone="danger"
            />
            <StatCard
              label="Exposure (low)"
              value={usd(exposureLow)}
              sub={`${blocked} × ${usd(TCPA_PENALTY_PER_MESSAGE.low)}`}
              tone="danger"
            />
            <StatCard
              label="Exposure (high)"
              value={usd(exposureHigh)}
              sub={`${blocked} × ${usd(TCPA_PENALTY_PER_MESSAGE.high)}`}
              tone="danger"
            />
          </div>
          <p className="text-xs text-ink-400">
            Hypothetical if all <span className="num">{blocked}</span> blocked leads were messaged in
            a single campaign — the gate prevents this exposure entirely.
          </p>
        </CardBody>
      </Card>

      <SectionLabel>A2P 10DLC registration</SectionLabel>

      {/* 3. A2P 10DLC */}
      <Card>
        <CardHeader
          title="A2P 10DLC registration"
          subtitle="Registered under the CLIENT's US EIN — TechAegisAI is the Twilio ISV reseller"
          action={<Badge tone={A2P_TONE[a2pStatus]}>{A2P_LABEL[a2pStatus]}</Badge>}
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-ink-400">Brand status: </span>
              <span className="font-medium text-ink-800">{A2P_LABEL[a2pStatus]}</span>
            </div>
            <div>
              <span className="text-ink-400">Client EIN: </span>
              <span className="num font-medium text-ink-800">
                {business.a2pBrandEin || "—"}
              </span>
            </div>
            <div>
              <span className="text-ink-400">From number: </span>
              <span className="num font-medium text-ink-800">
                {business.fromNumber || "—"}
              </span>
            </div>
          </div>
          <ul className="space-y-2">
            {A2P_STEPS.map((step, i) => {
              // Mark earlier steps complete when registered, partial when pending.
              const done =
                a2pStatus === "REGISTERED" ||
                (a2pStatus === "PENDING" && i < 2);
              return (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-money-500" />
                  ) : (
                    <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />
                  )}
                  <span className={done ? "text-ink-600" : "text-ink-500"}>{step}</span>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <SectionLabel>Hard-coded disclosures</SectionLabel>

      {/* 4. Hard-coded disclosures */}
      <Card>
        <CardHeader
          title="Hard-coded disclosures"
          subtitle="Every AI agent says these — AI-identity + recording notice + opt-out, baked in"
          action={<Mic className="h-5 w-5 text-signal-500" />}
        />
        <CardBody className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Disclosure
            label="Voice greeting suffix"
            note="Outbound AI voice requires proactive disclosure"
            text={DISCLOSURES.voiceGreetingSuffix}
          />
          <Disclosure
            label="SMS footer"
            note="Opt-out honored within 10 business days"
            text={DISCLOSURES.smsFooter}
          />
          <Disclosure
            label="Recording notice"
            note="Neutralizes all-party-consent states"
            text={DISCLOSURES.recordingNotice}
          />
        </CardBody>
      </Card>

      <SectionLabel>Scrub status</SectionLabel>

      {/* 5. Scrub status */}
      <Card>
        <CardHeader
          title="Scrub status"
          subtitle="National DNC + FCC Reassigned-Numbers DB ($0.005/number) — run before every campaign"
          action={<ScrubButton variant="secondary" label="Re-run scrubs" />}
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ScrubStat
            icon={<ShieldCheck className="h-4 w-4" />}
            title="National DNC"
            clear={dncClear}
            flagged={onDnc}
            flaggedLabel="on DNC"
          />
          <ScrubStat
            icon={<ShieldCheck className="h-4 w-4" />}
            title="FCC Reassigned-Numbers DB"
            clear={reassignedClear}
            flagged={reassigned}
            flaggedLabel="reassigned"
          />
        </CardBody>
      </Card>

      <SectionLabel>Audit trail</SectionLabel>

      {/* 6. Audit log */}
      <Card>
        <CardHeader
          title="Compliance audit log"
          subtitle="Consent records retained 5 years — the trail you show a carrier, the FCC, or a plaintiff"
          action={<ScrollText className="h-5 w-5 text-ink-400" />}
        />
        <CardBody className="pt-0">
          {auditRows.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-7 w-7" />}
              title="No compliance events yet"
              description="Scrubs, re-consents, and opt-outs are logged here automatically."
            />
          ) : (
            <AuditLog rows={auditRows} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Disclosure({
  label,
  note,
  text,
}: {
  label: string;
  note: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-ink-200/70 bg-ink-50/40 p-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-signal-500" />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm italic text-ink-700">&ldquo;{text}&rdquo;</p>
      <p className="mt-2 text-xs text-ink-400">{note}</p>
    </div>
  );
}

function ScrubStat({
  icon,
  title,
  clear,
  flagged,
  flaggedLabel,
}: {
  icon: React.ReactNode;
  title: string;
  clear: number;
  flagged: number;
  flaggedLabel: string;
}) {
  return (
    <div className="rounded-xl border border-ink-200/70 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-ink-800">
        <span className="text-money-500">{icon}</span>
        {title}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Badge tone="money">
          <span className="num">{clear}</span> clear
        </Badge>
        <Badge tone={flagged > 0 ? "danger" : "neutral"}>
          <span className="num">{flagged}</span> {flaggedLabel}
        </Badge>
      </div>
    </div>
  );
}

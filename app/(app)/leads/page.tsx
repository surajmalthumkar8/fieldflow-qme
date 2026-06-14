import { Ban, CheckCircle2, MailCheck, ShieldAlert, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/session";
import { smsBlockReasons } from "@/lib/compliance";
import type { ConsentStatus } from "@/lib/types";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  SectionLabel,
  StatCard,
} from "@/components/ui/primitives";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { CsvUpload } from "@/components/leads/CsvUpload";
import { ScrubButton } from "@/components/leads/ScrubButton";
import { needsReconsent } from "@/components/leads/consent";
import type { LeadRow } from "@/components/leads/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Leads & consent"
          description="The client's own, consented list — scrubbed and gated before any automation."
        />
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No business configured yet"
          description="Run `npm run setup` to seed the demo data, then reload this page."
        />
      </div>
    );
  }

  const leadsRaw = await prisma.lead.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
  });

  // Serialize for the client table (Dates -> ISO strings, precompute block reasons).
  const leads: LeadRow[] = leadsRaw.map((l) => ({
    id: l.id,
    firstName: l.firstName,
    lastName: l.lastName,
    phone: l.phone,
    email: l.email,
    source: l.source,
    consentStatus: l.consentStatus as ConsentStatus,
    consentSource: l.consentSource,
    consentChannel: l.consentChannel,
    dncStatus: l.dncStatus,
    reassignedStatus: l.reassignedStatus,
    smsEligible: l.smsEligible,
    blockReasons: smsBlockReasons({
      consentStatus: l.consentStatus as ConsentStatus,
      dncStatus: l.dncStatus,
      reassignedStatus: l.reassignedStatus,
    }),
    createdAt: l.createdAt.toISOString(),
  }));

  const total = leads.length;
  const eligibleCount = leads.filter((l) => l.smsEligible).length;
  const reconsentCount = leads.filter((l) => needsReconsent(l.consentStatus)).length;
  const optedOutCount = leads.filter((l) => l.consentStatus === "OPTED_OUT").length;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Leads & consent"
        description="The client's own, consented list — scrubbed against the National DNC + FCC Reassigned-Numbers DB and gated by written consent before any automation touches it."
      >
        <ScrubButton />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total leads"
          value={total}
          sub="On the active list"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="SMS-eligible"
          value={eligibleCount}
          sub="Written/re-consent + scrubbed clear"
          tone="money"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Needs re-consent"
          value={reconsentCount}
          sub="No PEWC yet — voice-only"
          tone="warn"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <StatCard
          label="Opted out"
          value={optedOutCount}
          sub="Suppressed permanently"
          tone="danger"
          icon={<Ban className="h-4 w-4" />}
        />
      </div>

      <SectionLabel>Import &amp; re-consent</SectionLabel>

      <Card>
        <CardHeader
          title="Import a consented list"
          subtitle="CSV upload runs the re-consent gate + DNC/Reassigned scrubs on every row"
        />
        <CardBody className="pt-0">
          <CsvUpload />
        </CardBody>
      </Card>

      <SectionLabel>The list</SectionLabel>

      <Card>
        <CardHeader
          title="Leads"
          subtitle="Color-coded by consent — only WRITTEN/RECONSENTED + scrubbed-clear leads are SMS-eligible"
          action={
            <span className="inline-flex items-center text-xs text-ink-400">
              <MailCheck className="mr-1 inline h-3.5 w-3.5" />
              <span className="num mr-1">{eligibleCount}</span> of{" "}
              <span className="num mx-1">{total}</span> eligible
            </span>
          }
        />
        <CardBody className="pt-0">
          <LeadsTable leads={leads} />
        </CardBody>
      </Card>
    </div>
  );
}

import { Settings2, Info } from "lucide-react";
import { getActiveBusiness } from "@/lib/session";
import { parseBusiness } from "@/lib/config";
import { tradeLabel } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ConfigForm, type ConfigFormData } from "@/components/config/ConfigForm";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Business Config"
          description="The one tenant config that feeds every layer."
        />
        <EmptyState
          icon={<Settings2 className="h-8 w-8" />}
          title="No business configured yet"
          description="Run `npm run setup` to seed the demo data, then reload this page."
        />
      </div>
    );
  }

  const parsed = parseBusiness(business);

  const initial: ConfigFormData = {
    name: business.name,
    trade: business.trade,
    phone: business.phone,
    serviceArea: business.serviceArea,
    timezone: business.timezone,
    brandVoice: business.brandVoice,
    hours: parsed.hours,
    services: parsed.services,
    faqs: parsed.faqs,
    escalation: parsed.escalation,
    monthlyRetainer: business.monthlyRetainer,
    pilotFee: business.pilotFee,
    kickerPerAppt: business.kickerPerAppt,
    avgJobValue: business.avgJobValue,
    a2pStatus: business.a2pStatus,
    a2pBrandEin: business.a2pBrandEin,
    fromNumber: business.fromNumber,
    consentNote: business.consentNote,
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Business Config"
        description="The single tenant record behind the whole engine."
      >
        <Badge tone="signal">{business.name}</Badge>
        <Badge tone="neutral">{tradeLabel(business.trade)}</Badge>
      </PageHeader>

      {/* The "one config, every layer" banner — mirrors the runbook concept. */}
      <div className="flex items-start gap-3 rounded-2xl border border-signal-200 bg-signal-50 px-5 py-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-signal-600" />
        <p className="text-sm leading-relaxed text-signal-800">
          This single config feeds the AI voice prompt, the FAQ/RAG knowledge, the
          reactivation copy, the A2P campaign, and the attribution math — change it
          once, every layer updates.
        </p>
      </div>

      <ConfigForm initial={initial} />
    </div>
  );
}

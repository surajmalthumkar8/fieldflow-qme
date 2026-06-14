import { PhoneCall } from "lucide-react";
import { getActiveBusiness } from "@/lib/session";
import { parseBusiness } from "@/lib/config";
import { tradeLabel } from "@/lib/format";
import { brainIsLive } from "@/lib/ai/brain";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { Receptionist } from "@/components/receptionist/Receptionist";

export const dynamic = "force-dynamic";

export default async function ReceptionistPage() {
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Receptionist"
          description="Live voice demo — talk to the AI and watch it book a job."
        />
        <EmptyState
          icon={<PhoneCall className="h-8 w-8" />}
          title="No business configured yet"
          description="Run `npm run setup` to seed the demo data, then reload this page."
        />
      </div>
    );
  }

  const { services } = parseBusiness(business);

  // Build a few realistic "quick scenario" prompts from this tenant's trade.
  const scenarios = buildScenarios(business.trade, services.map((s) => s.name));

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="AI Receptionist"
        description="A live, in-browser AI front desk. Talk to it (or type) and watch it qualify, then book a real job that lands on the attribution dashboard."
      />
      <Receptionist
        businessId={business.id}
        businessName={business.name}
        tradeLabel={tradeLabel(business.trade)}
        serviceArea={business.serviceArea}
        engineLive={brainIsLive()}
        scenarios={scenarios}
      />
    </div>
  );
}

function buildScenarios(
  trade: string,
  serviceNames: string[]
): { label: string; text: string }[] {
  const has = (kw: string) =>
    serviceNames.some((n) => n.toLowerCase().includes(kw));

  if (trade === "roofing") {
    return [
      {
        label: "Roof leak",
        text: "My roof is leaking after the storm last night, can someone come take a look tomorrow morning?",
      },
      {
        label: "Full replacement",
        text: "I think I need my whole roof replaced. Can I get an estimate this week?",
      },
      {
        label: "Emergency",
        text: "There's water pouring through my ceiling right now, this is an emergency!",
      },
    ];
  }

  // Default / HVAC-style scenarios.
  return [
    {
      label: has("replace") ? "AC replacement" : "AC not cooling",
      text: "My AC stopped cooling and the unit is pretty old. Can someone come out tomorrow at 9am?",
    },
    {
      label: "No heat (emergency)",
      text: "We have no heat at all and it's freezing — this feels like an emergency.",
    },
    {
      label: "Tune-up question",
      text: "How much do you charge for a furnace tune-up, and do you have any openings this week?",
    },
  ];
}

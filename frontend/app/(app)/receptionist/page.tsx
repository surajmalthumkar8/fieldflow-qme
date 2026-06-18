import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { Building2 } from "lucide-react";
import { Receptionist } from "@/components/receptionist/Receptionist";
import { PERSONA_NAME } from "@/lib/persona";
import { getActiveBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

const SCENARIOS = [
  { label: "Buy a home", text: "Hi, I'm looking to buy a 3-bed home, my budget is around $650k." },
  { label: "Sell my house", text: "I want to sell my house — can you help me get started?" },
  { label: "Investing", text: "I'm an investor looking for rental properties with good cash flow." },
  { label: "What can you do?", text: "Before that — what kind of things can you actually help me with?" },
];

// Uses the signed-in user's COMPANY (set at registration/login). Conversations,
// history and RAG all scope to this company's id.
export default async function ReceptionistPage() {
  const business = await getActiveBusiness();

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Receptionist" description="Talk to your AI receptionist." />
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No company yet"
          description="Register a company (Sign out → Register) and it becomes your tenant — then your receptionist appears here."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="AI Receptionist"
        description={`${PERSONA_NAME} is the AI receptionist for ${business.name}. Talk to her (or type) — she qualifies the lead, answers questions, and books a meeting. Runs on a local model.`}
      />
      <Receptionist
        businessId={business.id}
        businessName={business.name}
        tradeLabel="Real Estate"
        serviceArea={business.serviceArea}
        scenarios={SCENARIOS}
      />
    </div>
  );
}

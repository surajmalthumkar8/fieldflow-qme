import { PageHeader } from "@/components/ui/primitives";
import { Receptionist } from "@/components/receptionist/Receptionist";
import { PERSONA_NAME } from "@/lib/persona";

export const dynamic = "force-dynamic";

// The real-estate AI receptionist (Elara), powered by the local Ollama service.
// Demo tenant context — swap for the signed-in agency's business later.
const BUSINESS = {
  id: "re-demo",
  name: "Lone Star Realty",
  serviceArea: "Austin, TX metro",
};

const SCENARIOS = [
  { label: "Buy a home", text: "Hi, I'm looking to buy a 3-bed home in Austin, my budget is around $650k." },
  { label: "Sell my house", text: "I want to sell my house in Round Rock — can you help me get started?" },
  { label: "Investing", text: "I'm an investor looking for rental properties with good cash flow." },
  { label: "What can you do?", text: "Before that — what kind of things can you actually help me with?" },
];

export default function ReceptionistPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="AI Receptionist"
        description={`Call ${PERSONA_NAME}, our AI receptionist. Talk to her (or type) — she qualifies the lead, answers questions, and books a meeting. Runs on a local model.`}
      />
      <Receptionist
        businessId={BUSINESS.id}
        businessName={BUSINESS.name}
        tradeLabel="Real Estate"
        serviceArea={BUSINESS.serviceArea}
        scenarios={SCENARIOS}
      />
    </div>
  );
}

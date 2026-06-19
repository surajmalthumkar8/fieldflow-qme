import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { Building2 } from "lucide-react";
import { CustomerAgentPanel } from "@/components/receptionist/CustomerAgentPanel";
import { getActiveBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

// Customer's dedicated space to talk to their human agent + rate the AI and agent.
// Kept SEPARATE from the AI receptionist screen.
export default async function MyAgentPage() {
  const business = await getActiveBusiness();
  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Agent" description="Chat with your agent and share feedback." />
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No company yet"
          description="Register under a company first — then your agent and feedback options appear here."
        />
      </div>
    );
  }
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="My Agent"
        description="Talk to the human agent helping you, and rate your experience with the AI and your agent."
      />
      <div className="mx-auto max-w-2xl">
        <CustomerAgentPanel businessId={business.id} />
      </div>
    </div>
  );
}

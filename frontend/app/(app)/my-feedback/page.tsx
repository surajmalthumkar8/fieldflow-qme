import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { Building2 } from "lucide-react";
import { CustomerFeedback } from "@/components/receptionist/CustomerFeedback";
import { getActiveBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

// Customer's standalone feedback page — rate the AI and the agent separately.
export default async function MyFeedbackPage() {
  const business = await getActiveBusiness();
  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader title="Feedback" description="Rate your experience." />
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No company yet"
          description="Register under a company first — then you can share feedback here."
        />
      </div>
    );
  }
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Feedback" description="Tell us how we're doing — rate the AI assistant and your agent separately." />
      <div className="mx-auto max-w-2xl">
        <CustomerFeedback businessId={business.id} />
      </div>
    </div>
  );
}

import { PageHeader } from "@/components/ui/primitives";
import { AfterHoursAudit } from "@/components/audit/AfterHoursAudit";

export const metadata = {
  title: "After-Hours Audit · FieldFlow",
  description:
    "Grade a prospect's missed-call coverage live and model the revenue walking out the door.",
};

// The outbound lead-gen hook. A rep runs this live on a sales call: enter the
// prospect's details, place 5 simulated test calls, and turn an "F" coverage
// grade + a modeled lost-revenue range into the close. Fully client-side
// (no DB, no real calls) — the interactive tool lives in <AfterHoursAudit />.
export default function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="After-Hours Audit"
        description="The outbound hook. Run it live with a prospect: place test calls after hours, grade their coverage, and model the high-ticket revenue their phone is missing — then hand them the fix."
      />
      <AfterHoursAudit />
    </div>
  );
}

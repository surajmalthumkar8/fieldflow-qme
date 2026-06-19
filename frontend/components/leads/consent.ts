import type { ConsentStatus } from "@/lib/types";

type Tone = "neutral" | "signal" | "money" | "warn" | "danger";

// Color-coding contract: WRITTEN/RECONSENTED = money, IMPLIED/UNKNOWN = warn,
// OPTED_OUT = danger.
export const CONSENT_META: Record<ConsentStatus, { label: string; tone: Tone }> = {
  WRITTEN: { label: "Written consent", tone: "money" },
  RECONSENTED: { label: "Re-consented", tone: "money" },
  IMPLIED: { label: "Implied only", tone: "warn" },
  UNKNOWN: { label: "Unknown", tone: "warn" },
  OPTED_OUT: { label: "Opted out", tone: "danger" },
};

/** True when a lead needs the operator-sent re-consent gate (not yet PEWC, not opted out). */
export function needsReconsent(consentStatus: ConsentStatus): boolean {
  return (
    consentStatus !== "WRITTEN" &&
    consentStatus !== "RECONSENTED" &&
    consentStatus !== "OPTED_OUT"
  );
}

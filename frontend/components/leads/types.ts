import type { ConsentStatus } from "@/lib/types";

// Serializable lead shape passed from the server page to client components
// (Dates already converted to ISO strings).
export interface LeadRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  source: string;
  consentStatus: ConsentStatus;
  consentSource: string;
  consentChannel: string;
  dncStatus: string;
  reassignedStatus: string;
  smsEligible: boolean;
  blockReasons: string[];
  createdAt: string;
}

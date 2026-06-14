// The compliance gate — this is the MOAT, not overhead (VALIDATED-STRATEGY §9).
// Everything here encodes the non-negotiable TCPA / A2P / disclosure rules.

import type { ConsentStatus } from "./types";

/**
 * Hard-coded disclosures every AI agent must say. Outbound voice REQUIRES
 * proactive AI-identity disclosure (CA AB 2905 + FCC artificial-voice); inbound
 * floor is "disclose if asked" but we disclose anyway (cheap CIPA defense).
 * "This call may be recorded" neutralizes all-party-consent states.
 */
export const DISCLOSURES = {
  voiceGreetingSuffix:
    "Quick note — I'm an AI assistant and this call may be recorded for quality. You can say 'stop' anytime to opt out.",
  smsFooter: "Reply STOP to opt out.",
  recordingNotice: "This call may be recorded for quality.",
  aiIdentity: "I'm an AI assistant",
} as const;

/**
 * A lead is eligible for AUTOMATED SMS / AI-voice marketing only with prior
 * express WRITTEN consent (PEWC) per lead — "existing business relationship"
 * gives ZERO cover for automation. Implied consent covers service msgs only.
 */
export function isSmsEligible(params: {
  consentStatus: ConsentStatus;
  dncStatus: string;
  reassignedStatus: string;
}): boolean {
  const consentOk =
    params.consentStatus === "WRITTEN" ||
    params.consentStatus === "RECONSENTED";
  const dncOk = params.dncStatus === "CLEAR";
  const reassignedOk = params.reassignedStatus === "CLEAR";
  return consentOk && dncOk && reassignedOk;
}

/** Why a lead is NOT yet SMS-eligible — drives the re-consent gate UI. */
export function smsBlockReasons(params: {
  consentStatus: ConsentStatus;
  dncStatus: string;
  reassignedStatus: string;
}): string[] {
  const reasons: string[] = [];
  if (params.consentStatus === "OPTED_OUT") reasons.push("Opted out (STOP)");
  else if (params.consentStatus !== "WRITTEN" && params.consentStatus !== "RECONSENTED")
    reasons.push("No written consent (re-consent required)");
  if (params.dncStatus !== "CLEAR") reasons.push("Not scrubbed against National DNC");
  if (params.reassignedStatus !== "CLEAR")
    reasons.push("Not scrubbed against FCC Reassigned-Numbers DB");
  return reasons;
}

/**
 * Deterministic simulated scrubs (a real build calls the National DNC + the
 * FCC Reassigned-Numbers DB at $0.005/number). Seeded by phone digits so the
 * demo is stable and a small, realistic fraction flags.
 */
function digitSum(phone: string): number {
  return phone.replace(/\D/g, "").split("").reduce((a, c) => a + Number(c), 0);
}

export function simulateDncScrub(phone: string): "CLEAR" | "ON_DNC" {
  // ~1 in 12 flagged.
  return digitSum(phone) % 12 === 0 ? "ON_DNC" : "CLEAR";
}

export function simulateReassignedScrub(phone: string): "CLEAR" | "REASSIGNED" {
  // ~1 in 15 flagged.
  return digitSum(phone) % 15 === 0 ? "REASSIGNED" : "CLEAR";
}

/** Per-message TCPA exposure if you message a non-consented lead (no aggregate cap). */
export const TCPA_PENALTY_PER_MESSAGE = { low: 500, high: 1500 } as const;

/** The re-consent message a HUMAN sends before any automation touches a list. */
export function reconsentMessage(businessName: string): string {
  return `Hi, it's ${businessName}. We'd like to send you occasional service reminders and offers by text. Reply YES to opt in, or ignore this message. ${DISCLOSURES.smsFooter}`;
}

export const A2P_STEPS = [
  "Complete the client's Business Profile (legal name, EIN 15+ days old, address, website)",
  "Register the client as a Standard A2P Brand using the CLIENT's US EIN (~$46) — you are the Twilio ISV reseller",
  "Register a Campaign (Customer Care / Marketing) with sample messages + STOP opt-out (~$15)",
  "One Brand + Campaign per client — never share numbers across clients (snowshoeing = carrier ban)",
  "Allow ~5–10 day vetting — start day 1 of onboarding",
] as const;

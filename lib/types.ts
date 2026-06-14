// Shared domain types + the parsed shapes of the JSON-string columns on Business.
// Feature code should import these rather than re-deriving them.

export type Trade = "hvac" | "roofing" | "plumbing" | "electrical";

export type ConsentStatus =
  | "UNKNOWN"
  | "IMPLIED"
  | "WRITTEN"
  | "RECONSENTED"
  | "OPTED_OUT";

export type ScrubStatus = "UNCHECKED" | "CLEAR" | "ON_DNC" | "REASSIGNED";

export type BookingStatus =
  | "BOOKED"
  | "CONFIRMED"
  | "HELD"
  | "NO_SHOW"
  | "CANCELLED";

export type BookingSource = "REACTIVATION" | "INBOUND_VOICE" | "SPEED_TO_LEAD";

export type Channel = "VOICE" | "SMS";
export type Direction = "INBOUND" | "OUTBOUND";
export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export type A2PStatus = "NOT_STARTED" | "PENDING" | "REGISTERED";

// ---- Parsed Business config shapes (stored as JSON strings in SQLite) ----

export interface BusinessHours {
  mon_fri?: string;
  sat?: string;
  sun?: string;
  after_hours_policy?: string;
}

export interface ServiceItem {
  name: string;
  priceLow: number;
  priceHigh: number;
  highTicket?: boolean; // true for $5k+ jobs (kicker-eligible)
}

export interface Faq {
  q: string;
  a: string;
}

export interface Escalation {
  highValueTriggers?: string[];
  transferNumber?: string;
  alertChannel?: "slack" | "sms";
}

// ---- AI brain contract (see lib/ai/brain.ts) ----

export interface BrainTurn {
  role: "user" | "assistant";
  content: string;
}

/** A structured action the brain wants the app to take. */
export interface BrainAction {
  type: "book" | "escalate" | "opt_out" | "callback" | "none";
  // Booking details (when type === "book").
  service?: string;
  jobType?: string;
  preferredTime?: string;
  estimatedValue?: number;
  customerName?: string;
  notes?: string;
}

export type Sentiment = "positive" | "neutral" | "negative";

export interface BrainResult {
  reply: string;
  action: BrainAction;
  qualified: boolean;
  /** Whether this response came from live Claude ("live") or the demo brain ("demo"). */
  engine: "live" | "demo";
  /** Post-turn analysis (agentic): caller sentiment + a short running summary. */
  sentiment?: Sentiment;
  summary?: string;
  /** When not booking, the categorized reason (pricing | out_of_area | not_interested | needs_human | info_only). */
  reason?: string;
}

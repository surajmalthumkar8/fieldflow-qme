// Shared presentational mappings for conversation outcomes. Pure functions /
// constants only — safe to import into both server and client components.

type BadgeTone = "neutral" | "signal" | "money" | "warn" | "flare" | "danger";

export const OUTCOME_LABELS: Record<string, string> = {
  BOOKED: "Booked",
  CALLBACK: "Callback",
  ESCALATED: "Escalated",
  NOT_INTERESTED: "Not interested",
  NO_ANSWER: "No answer",
  OPTED_OUT: "Opted out",
};

export const OUTCOME_TONES: Record<string, BadgeTone> = {
  BOOKED: "money",
  CALLBACK: "warn",
  ESCALATED: "warn",
  NOT_INTERESTED: "neutral",
  NO_ANSWER: "neutral",
  OPTED_OUT: "danger",
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? (outcome || "—");
}

export function outcomeTone(outcome: string): BadgeTone {
  return OUTCOME_TONES[outcome] ?? "neutral";
}

export const BOOKING_STATUS_TONES: Record<string, BadgeTone> = {
  BOOKED: "signal",
  CONFIRMED: "signal",
  HELD: "money",
  NO_SHOW: "warn",
  CANCELLED: "danger",
};

export function bookingStatusTone(status: string): BadgeTone {
  return BOOKING_STATUS_TONES[status] ?? "neutral";
}

// --- Sentiment (post-call analysis) ------------------------------------------

export type Sentiment = "positive" | "neutral" | "negative";

export const SENTIMENT_LABELS: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export const SENTIMENT_TONES: Record<string, BadgeTone> = {
  positive: "money",
  neutral: "neutral",
  negative: "danger",
};

export function sentimentLabel(s: string): string {
  return SENTIMENT_LABELS[s] ?? "Neutral";
}

export function sentimentTone(s: string): BadgeTone {
  return SENTIMENT_TONES[s] ?? "neutral";
}

// --- Outcome reason (why the conversation landed where it did) ----------------

export const OUTCOME_REASON_LABELS: Record<string, string> = {
  info_only: "Info only",
  pricing: "Pricing question",
  out_of_area: "Out of area",
  not_interested: "Not interested",
  needs_human: "Needs a human",
  booked: "Booked",
};

export const OUTCOME_REASON_TONES: Record<string, BadgeTone> = {
  info_only: "neutral",
  pricing: "signal",
  out_of_area: "warn",
  not_interested: "neutral",
  needs_human: "flare",
  booked: "money",
};

export function outcomeReasonLabel(reason: string): string {
  return OUTCOME_REASON_LABELS[reason] ?? (reason || "—");
}

export function outcomeReasonTone(reason: string): BadgeTone {
  return OUTCOME_REASON_TONES[reason] ?? "neutral";
}

/** mm:ss for a voice call duration. */
export function fmtDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Coarse relative time ("3d ago", "2h ago") for transcript turns. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(iso);
}

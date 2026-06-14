// The AI brain. Dual-mode by design so the product works with zero keys:
//   • ANTHROPIC_API_KEY set  -> live Claude Haiku (the production path)
//   • no key                 -> deterministic demo brain (a believable state machine)
// Both return the same BrainResult contract, so feature code never branches.

import Anthropic from "@anthropic-ai/sdk";
import type { Business } from "@prisma/client";
import type { BrainAction, BrainResult, BrainTurn } from "../types";
import { parseBusiness } from "../config";
import { DISCLOSURES } from "../compliance";
import { receptionistSystemPrompt, reactivationSystemPrompt } from "./prompts";

export type BrainMode = "receptionist" | "reactivation";

export interface RunBrainArgs {
  business: Business;
  mode: BrainMode;
  history: BrainTurn[]; // prior turns (not including the new user message)
  userMessage: string;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export function brainIsLive(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function runBrain(args: RunBrainArgs): Promise<BrainResult> {
  if (brainIsLive()) {
    try {
      return await runLiveBrain(args);
    } catch (err) {
      // Never let a transient API error break the demo — fall back gracefully.
      console.error("[brain] live call failed, falling back to demo brain:", err);
      return runDemoBrain(args);
    }
  }
  return runDemoBrain(args);
}

// ---------------------------------------------------------------------------
// Live brain (Claude Haiku)
// ---------------------------------------------------------------------------

async function runLiveBrain(args: RunBrainArgs): Promise<BrainResult> {
  const { business, mode, history, userMessage } = args;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system =
    mode === "receptionist"
      ? receptionistSystemPrompt(business)
      : reactivationSystemPrompt(business);

  const messages: Anthropic.MessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: userMessage },
  ];

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    temperature: 0.5,
    system,
    messages,
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const parsed = parseEnvelope(text);
  return { ...parsed, engine: "live" };
}

/** Extract the strict JSON envelope; tolerate stray prose around it. */
function parseEnvelope(text: string): Omit<BrainResult, "engine"> {
  const fallback: Omit<BrainResult, "engine"> = {
    reply: text || "Sorry, could you say that again?",
    action: { type: "none" },
    qualified: false,
    sentiment: "neutral",
  };
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return fallback;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    const sentiment = ["positive", "neutral", "negative"].includes(obj.sentiment)
      ? obj.sentiment
      : "neutral";
    return {
      reply: String(obj.reply ?? fallback.reply),
      qualified: Boolean(obj.qualified),
      action: normalizeAction(obj.action),
      sentiment,
      reason: str(obj.reason),
    };
  } catch {
    return fallback;
  }
}

function normalizeAction(a: unknown): BrainAction {
  if (!a || typeof a !== "object") return { type: "none" };
  const o = a as Record<string, unknown>;
  const type = o.type as BrainAction["type"];
  const valid: BrainAction["type"][] = ["book", "escalate", "opt_out", "callback", "none"];
  return {
    type: valid.includes(type) ? type : "none",
    service: str(o.service),
    jobType: str(o.jobType),
    preferredTime: str(o.preferredTime),
    estimatedValue: typeof o.estimatedValue === "number" ? o.estimatedValue : undefined,
    customerName: str(o.customerName),
    notes: str(o.notes),
  };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// ---------------------------------------------------------------------------
// Demo brain (deterministic, believable conversation state machine)
// ---------------------------------------------------------------------------

const AFFIRMATIVE = /\b(yes|yeah|yep|yup|sure|ok|okay|correct|right|sounds good|please|let'?s do it|book|schedule|that works|confirm)\b/i;
const NEGATIVE = /\b(no|nope|not|wrong|change|different|actually|instead)\b/i;
const STOP = /\b(stop|unsubscribe|remove me|opt out|do not (text|contact)|quit)\b/i;
const EMERGENCY = /\b(emergency|no heat|no air|flood|flooding|gas leak|sparking|burning|leak(ing)?|carbon monoxide|smoke)\b/i;
const FRUSTRATED = /\b(angry|upset|frustrated|ridiculous|terrible|awful|unacceptable|waited|still no|again)\b/i;
const TIME_HINT = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|noon|am|pm|\d{1,2}\s?(am|pm|o'?clock)|next week|this week)\b/i;
const QUESTION = /\?|\b(do you|are you|can you|how much|what('?s| is)|when|where|warranty|finance|financing|insured|licensed|hours|cost|price)\b/i;

function matchService(business: Business, text: string): { name: string; value: number; highTicket: boolean } | null {
  const { services } = parseBusiness(business);
  const lower = text.toLowerCase();
  for (const s of services) {
    const words = s.name.toLowerCase().split(/[\s/]+/).filter((w) => w.length > 3);
    if (words.some((w) => lower.includes(w))) {
      return { name: s.name, value: Math.round((s.priceLow + s.priceHigh) / 2), highTicket: !!s.highTicket };
    }
  }
  const first = services.find((s) => s.priceHigh > 0) ?? services[0];
  if (/\b(ac|a\/c|air|cool|furnace|heat|hvac|thermostat|unit|install|replace)\b/i.test(text) && first)
    return { name: first.name, value: Math.round((first.priceLow + first.priceHigh) / 2), highTicket: !!first.highTicket };
  if (/\b(roof|shingle|leak|gutter|storm|hail)\b/i.test(text) && first)
    return { name: first.name, value: Math.round((first.priceLow + first.priceHigh) / 2), highTicket: !!first.highTicket };
  return null;
}

/** FAQ grounding (RAG-lite): match the question to a configured FAQ by keyword overlap. */
function matchFaq(business: Business, text: string): string | null {
  const { faqs } = parseBusiness(business);
  if (!faqs.length) return null;
  const lower = text.toLowerCase();
  const stop = new Set(["what", "your", "you", "the", "are", "can", "how", "much", "does", "with", "for", "and", "is", "do"]);
  let best: { a: string; score: number } | null = null;
  for (const f of faqs) {
    const qWords = f.q.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !stop.has(w));
    const score = qWords.filter((w) => lower.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { a: f.a, score };
  }
  return best ? best.a : null;
}

const SLOTS = ["tomorrow at 9am", "Thursday at 2pm"];
function nextSlotPhrase(): string {
  return `I've got ${SLOTS[0]} or ${SLOTS[1]}`;
}

/** Did the assistant just read back details for confirmation? (drives the two-step booking) */
function awaitingConfirm(history: BrainTurn[]): boolean {
  const lastAssistant = [...history].reverse().find((t) => t.role === "assistant");
  return !!lastAssistant && /confirm|is that right|read that back|got that right|all set\?/i.test(lastAssistant.content);
}

function offeredSlot(history: BrainTurn[]): boolean {
  return history.some((h) => h.role === "assistant" && /(9am|2pm|slot|open|which works)/i.test(h.content));
}

function sentimentOf(text: string, affirmative: boolean): "positive" | "neutral" | "negative" {
  if (FRUSTRATED.test(text)) return "negative";
  if (affirmative || /\b(thanks|thank you|great|perfect|awesome|appreciate)\b/i.test(text)) return "positive";
  return "neutral";
}

function runDemoBrain(args: RunBrainArgs): BrainResult {
  const { business, mode, history, userMessage } = args;
  const text = userMessage.trim();
  const assistantTurns = history.filter((t) => t.role === "assistant").length;
  const base = { engine: "demo" as const };

  // Compose-an-opener request (from the reactivation compose route): return a
  // proper Touch-1 outreach text, not a mid-conversation reply.
  if (mode === "reactivation" && /write the opening|reactivation text|opening text/i.test(text)) {
    const angleMatch = text.match(/angle:\s*"([^"]+)"/i);
    const angle = angleMatch ? angleMatch[1] : "";
    const what = business.trade === "roofing" ? "give your roof a free inspection" : "get your system checked";
    const seasonClause = angle ? ` about ${angle}` : " before the season";
    return {
      ...base,
      reply: `Hi, it's ${business.name} — we're reaching out to past customers${seasonClause} and would love to ${what} and get you back on the schedule. Reply YES and I'll grab you a time.`,
      action: { type: "none" },
      qualified: false,
      sentiment: "neutral",
    };
  }

  const affirmative = AFFIRMATIVE.test(text);
  const sentiment = sentimentOf(text, affirmative);

  // Opt-out always wins.
  if (STOP.test(text)) {
    return {
      ...base,
      reply:
        mode === "reactivation"
          ? `You're opted out and won't hear from ${business.name} again. Take care!`
          : `No problem — you're opted out. Thanks for calling ${business.name}.`,
      action: { type: "opt_out" },
      qualified: false,
      sentiment: "neutral",
      reason: "not_interested",
    };
  }

  // Emergencies escalate (capture + alert the owner).
  if (EMERGENCY.test(text)) {
    return {
      ...base,
      reply: `That sounds urgent — I'm alerting ${business.name}'s on-call team right now and someone will call you in minutes. What's the best number?`,
      action: { type: "escalate", notes: `Emergency: ${text.slice(0, 80)}` },
      qualified: true,
      sentiment: "negative",
      reason: "needs_human",
    };
  }

  // First assistant turn: greet + disclosure.
  if (assistantTurns === 0 && mode === "receptionist") {
    return {
      ...base,
      reply: `Thanks for calling ${business.name}! ${DISCLOSURES.voiceGreetingSuffix} How can I help you today?`,
      action: { type: "none" },
      qualified: false,
      sentiment: "neutral",
    };
  }

  const svc = matchService(business, text + " " + history.map((h) => h.content).join(" "));

  // STEP 2 of booking: we read back details last turn — confirm or revise.
  if (awaitingConfirm(history)) {
    if (affirmative && !NEGATIVE.test(text) && svc) {
      return {
        ...base,
        reply: `You're all set for ${svc.name.toLowerCase()}. You'll get a confirmation text now, plus reminders before the visit. Anything else?`,
        action: { type: "book", service: svc.name, jobType: svc.name, preferredTime: extractTime(history), estimatedValue: svc.value, notes: "Confirmed via demo brain" },
        qualified: true,
        sentiment: "positive",
        reason: "booked",
      };
    }
    return {
      ...base,
      reply: `No problem — what would you like to change, the time or the service?`,
      action: { type: "none" },
      qualified: true,
      sentiment,
    };
  }

  // FAQ grounding: answer a question from the knowledge base, then nudge to book.
  if (QUESTION.test(text) && !TIME_HINT.test(text)) {
    const answer = matchFaq(business, text);
    if (answer) {
      return {
        ...base,
        reply: `${answer} Want me to get you on the schedule?`,
        action: { type: "none" },
        qualified: true,
        sentiment,
        reason: "info_only",
      };
    }
    if (!svc) {
      return {
        ...base,
        reply: `Good question — I'll have the team confirm that detail. In the meantime, can I get you booked for a visit?`,
        action: { type: "none" },
        qualified: false,
        sentiment,
        reason: "info_only",
      };
    }
  }

  const hasTime = TIME_HINT.test(text);

  // We know the service AND a time (or they picked an offered slot) -> READ BACK to confirm.
  if (svc && (hasTime || (affirmative && offeredSlot(history)))) {
    const when = hasTime ? humanTime(text) : SLOTS[0];
    return {
      ...base,
      reply: `Just to confirm: ${svc.name.toLowerCase()}, ${when} — is that right?`,
      action: { type: "none", service: svc.name, estimatedValue: svc.value, preferredTime: when },
      qualified: true,
      sentiment: "positive",
    };
  }

  // We know the service but need a time -> offer specific open slots (availability-gated).
  if (svc) {
    return {
      ...base,
      reply: `Got it — ${svc.name.toLowerCase()}. ${nextSlotPhrase()} — which works better?`,
      action: { type: "none", service: svc.name, estimatedValue: svc.value },
      qualified: true,
      sentiment,
    };
  }

  // Reactivation interest without specifics -> nudge to a slot.
  if (mode === "reactivation" && affirmative) {
    return {
      ...base,
      reply: `Great to hear from you! ${nextSlotPhrase()} for a visit — which works?`,
      action: { type: "none" },
      qualified: true,
      sentiment: "positive",
    };
  }

  // Otherwise ask a focused qualifying question.
  return {
    ...base,
    reply:
      mode === "receptionist"
        ? `Happy to help — is this a repair, a new install, or a question about service?`
        : `This is ${business.name}. We'd love to get you back on the schedule — reply YES and I'll grab a time, or STOP to opt out.`,
    action: { type: "none" },
    qualified: false,
    sentiment,
    reason: "info_only",
  };
}

/** Pull a clean, human-friendly time phrase out of the user's message. */
function humanTime(text: string): string {
  const m = text.match(
    /\b(today|tomorrow|this week|next week|(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b(?:\s+(?:at\s+)?(?:\d{1,2}(?::\d{2})?\s?(?:am|pm)|morning|afternoon|evening|noon))?|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i
  );
  if (!m) return SLOTS[0];
  // Strip a leading "on " and any trailing punctuation.
  return m[0].replace(/^on\s+/i, "").replace(/[^\w: ]+$/, "").trim();
}

function extractTime(history: BrainTurn[]): string {
  const lastAssistant = [...history].reverse().find((t) => t.role === "assistant");
  if (lastAssistant) {
    const m = lastAssistant.content.match(/confirm:[^,]*,\s*([^—]+?)\s*—/i);
    if (m) return m[1].trim();
  }
  return SLOTS[0];
}

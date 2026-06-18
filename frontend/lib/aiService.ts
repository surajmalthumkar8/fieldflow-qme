// Client for the FastAPI AI/voice microservice (backend/). When AI_SERVICE_URL
// is set, the receptionist + lead engine route through the local Ollama-backed
// service; otherwise callers fall back to the in-process brain (lib/ai/brain.ts).
//
// Mirrors the same live-vs-demo swap pattern the rest of the codebase uses.

export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiChatResult {
  reply: string;
  qualified: boolean;
  sentiment: "positive" | "neutral" | "negative";
  action: { type: "schedule" | "route_to_agent" | "capture_contact" | "raise_ticket" | "none"; notes?: string | null };
  captured: Record<string, string>;
  engine: string;
  conversation_id?: string | null;
}

export interface AiQualifyResult {
  leadGrade: "HOT" | "WARM" | "COLD";
  leadScore: number;
  intentScore: number;
  budgetEstimate: number;
  opportunitySize: number;
  sentiment: "positive" | "neutral" | "negative";
  rationale: string;
  captured: Record<string, string>;
}

export interface AiSummaryResult {
  summary: string;
  nextStep: string;
  keyFacts: string[];
}

const BASE = process.env.AI_SERVICE_URL?.replace(/\/$/, "") ?? "";

export function aiServiceEnabled(): boolean {
  return Boolean(BASE);
}

async function post<T>(path: string, body: unknown, timeoutMs = 120_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`AI service ${path} -> ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function aiChat(input: {
  business_id: string;
  business_name: string;
  service_area?: string;
  history?: AiTurn[];
  message: string;
  use_kb?: boolean;
  conversation_id?: string | null;
  user_id?: string | null;
  customer_name?: string;
  customer_email?: string;
  customer_profile?: string;
}): Promise<AiChatResult> {
  return post<AiChatResult>("/chat", { use_kb: true, history: [], service_area: "", ...input });
}

export interface AiConversationSummary {
  id: string;
  title: string;
  lead_name: string;
  updated_at: string | null;
  preview: string;
  message_count: number;
}

export function aiListConversations(businessId: string): Promise<AiConversationSummary[]> {
  return fetch(`${BASE}/conversations?business_id=${encodeURIComponent(businessId)}`, {
    cache: "no-store",
  }).then((r) => (r.ok ? r.json() : []));
}

export function aiGetConversation(id: string): Promise<{ id: string; title: string; messages: AiTurn[] }> {
  return fetch(`${BASE}/conversations/${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) =>
    r.ok ? r.json() : { id, title: "", messages: [] }
  );
}

export function aiQualify(history: AiTurn[]): Promise<AiQualifyResult> {
  return post<AiQualifyResult>("/qualify", { history });
}

export function aiSummarize(history: AiTurn[]): Promise<AiSummaryResult> {
  return post<AiSummaryResult>("/summarize", { history });
}

/** Fetch female-voice WAV bytes for a line of text. Returns null if unavailable. */
export async function aiVoice(text: string): Promise<ArrayBuffer | null> {
  if (!BASE) return null;
  const res = await fetch(`${BASE}/voice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.arrayBuffer();
}

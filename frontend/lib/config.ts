// Safe parse/serialize helpers for the JSON-string columns on Business.
// SQLite has no JSON type, so config travels as text and is parsed here.

import type { Business } from "@prisma/client";
import type {
  BusinessHours,
  Escalation,
  Faq,
  ServiceItem,
} from "./types";

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export interface ParsedBusiness {
  hours: BusinessHours;
  services: ServiceItem[];
  faqs: Faq[];
  escalation: Escalation;
  tags: string[];
}

export function parseBusiness(b: Business): ParsedBusiness {
  return {
    hours: safeParse<BusinessHours>(b.hours, {}),
    services: safeParse<ServiceItem[]>(b.services, []),
    faqs: safeParse<Faq[]>(b.faqs, []),
    escalation: safeParse<Escalation>(b.escalation, {}),
    tags: [],
  };
}

export function parseTags(raw: string | null | undefined): string[] {
  return safeParse<string[]>(raw, []);
}

export const HIGH_TICKET_THRESHOLD = 5000; // contractual "high-ticket" job value

export function isHighTicket(value: number): boolean {
  return value >= HIGH_TICKET_THRESHOLD;
}

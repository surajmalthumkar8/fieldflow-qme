import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveBusinessId } from "@/lib/session";
import type {
  BusinessHours,
  Escalation,
  Faq,
  ServiceItem,
} from "@/lib/types";

const TRADES = ["hvac", "roofing", "plumbing", "electrical"];
const A2P_STATUSES = ["NOT_STARTED", "PENDING", "REGISTERED"];
const ALERT_CHANNELS = ["slack", "sms"];

/** The shape the config form sends back. Validated/sanitized before write. */
interface ConfigPayload {
  name?: string;
  trade?: string;
  phone?: string;
  serviceArea?: string;
  timezone?: string;
  brandVoice?: string;
  hours?: BusinessHours;
  services?: ServiceItem[];
  faqs?: Faq[];
  escalation?: Escalation;
  monthlyRetainer?: number;
  pilotFee?: number;
  kickerPerAppt?: number;
  avgJobValue?: number;
  a2pStatus?: string;
  a2pBrandEin?: string;
  fromNumber?: string;
  consentNote?: string;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cleanServices(input: unknown): ServiceItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => ({
      name: str((s as ServiceItem)?.name).trim(),
      priceLow: num((s as ServiceItem)?.priceLow),
      priceHigh: num((s as ServiceItem)?.priceHigh),
      highTicket: Boolean((s as ServiceItem)?.highTicket),
    }))
    .filter((s) => s.name.length > 0);
}

function cleanFaqs(input: unknown): Faq[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((f) => ({
      q: str((f as Faq)?.q).trim(),
      a: str((f as Faq)?.a).trim(),
    }))
    .filter((f) => f.q.length > 0 || f.a.length > 0);
}

async function handle(req: Request) {
  const businessId = await getActiveBusinessId();
  if (!businessId) {
    return NextResponse.json(
      { ok: false, error: "No active business" },
      { status: 404 }
    );
  }

  let body: ConfigPayload;
  try {
    body = (await req.json()) as ConfigPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const trade = TRADES.includes(str(body.trade)) ? str(body.trade) : undefined;
  const a2pStatus = A2P_STATUSES.includes(str(body.a2pStatus))
    ? str(body.a2pStatus)
    : "NOT_STARTED";

  const hours: BusinessHours = {
    mon_fri: str(body.hours?.mon_fri),
    sat: str(body.hours?.sat),
    sun: str(body.hours?.sun),
    after_hours_policy: str(body.hours?.after_hours_policy),
  };

  const rawAlert = str(body.escalation?.alertChannel);
  const escalation: Escalation = {
    highValueTriggers: Array.isArray(body.escalation?.highValueTriggers)
      ? body.escalation!.highValueTriggers!.map((t) => str(t).trim()).filter(Boolean)
      : [],
    transferNumber: str(body.escalation?.transferNumber),
    alertChannel: (ALERT_CHANNELS.includes(rawAlert) ? rawAlert : "sms") as
      | "slack"
      | "sms",
  };

  const name = str(body.name).trim();
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Business name is required" },
      { status: 400 }
    );
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      name,
      ...(trade ? { trade } : {}),
      phone: str(body.phone),
      serviceArea: str(body.serviceArea),
      timezone: str(body.timezone) || "America/Chicago",
      brandVoice: str(body.brandVoice),
      hours: JSON.stringify(hours),
      services: JSON.stringify(cleanServices(body.services)),
      faqs: JSON.stringify(cleanFaqs(body.faqs)),
      escalation: JSON.stringify(escalation),
      monthlyRetainer: num(body.monthlyRetainer),
      pilotFee: num(body.pilotFee),
      kickerPerAppt: num(body.kickerPerAppt),
      avgJobValue: num(body.avgJobValue),
      a2pStatus,
      a2pBrandEin: str(body.a2pBrandEin),
      fromNumber: str(body.fromNumber),
      consentNote: str(body.consentNote),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

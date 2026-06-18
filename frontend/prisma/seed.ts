// Deterministic demo seed. Creates two realistic home-services clients with a
// full attribution funnel (calls + texts -> qualified -> booked -> held -> $),
// varied consent + scrub states, and a compliance audit trail. Re-runnable.

import { PrismaClient } from "@prisma/client";
import { simulateDncScrub, simulateReassignedScrub } from "../lib/compliance";

const prisma = new PrismaClient();

// Small seeded PRNG so the demo is stable across reseeds.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86400_000);

const FIRST = ["James", "Maria", "Robert", "Linda", "David", "Patricia", "John", "Jennifer", "Michael", "Susan", "Carlos", "Angela", "Brian", "Nicole", "Kevin", "Deborah", "Tom", "Rachel", "Greg", "Wendy", "Sam", "Tina", "Hector", "Paula"];
const LAST = ["Reyes", "Nguyen", "Thompson", "Garcia", "Miller", "Davis", "Wilson", "Brooks", "Cole", "Hayes", "Patel", "Foster", "Ramirez", "Bennett", "Ward", "Russell", "Sanders", "Price", "Diaz", "Hughes"];

function phone(i: number): string {
  const area = pick(["512", "737", "214", "469", "972", "210"]);
  const mid = String(200 + ((i * 37) % 700)).padStart(3, "0");
  const last = String((i * 4099) % 10000).padStart(4, "0");
  return `+1${area}${mid}${last}`;
}

interface BizDef {
  slug: string;
  name: string;
  trade: string;
  serviceArea: string;
  monthlyRetainer: number;
  pilotFee: number;
  kickerPerAppt: number;
  avgJobValue: number;
  brandVoice: string;
  services: { name: string; priceLow: number; priceHigh: number; highTicket?: boolean }[];
  faqs: { q: string; a: string }[];
  hours: Record<string, string>;
  escalation: { highValueTriggers: string[]; transferNumber: string; alertChannel: "slack" | "sms" };
  fromNumber: string;
  a2pStatus: string;
  a2pBrandEin: string;
  consentNote: string;
}

const BUSINESSES: BizDef[] = [
  {
    slug: "summit-comfort",
    name: "Summit Comfort Heating & Air",
    trade: "hvac",
    serviceArea: "Austin, TX metro (78701–78759)",
    monthlyRetainer: 3500,
    pilotFee: 2250,
    kickerPerAppt: 200,
    avgJobValue: 9200,
    brandVoice: "warm, neighborly, straight-talking",
    services: [
      { name: "AC system replacement", priceLow: 7500, priceHigh: 16000, highTicket: true },
      { name: "Furnace replacement", priceLow: 6000, priceHigh: 12000, highTicket: true },
      { name: "AC repair", priceLow: 180, priceHigh: 850 },
      { name: "Maintenance tune-up", priceLow: 89, priceHigh: 220 },
    ],
    faqs: [
      { q: "Do you offer financing?", a: "Yes — 0% for 18 months on approved credit for system replacements." },
      { q: "Are you licensed and insured?", a: "Yes, TACLA #00012345, fully insured." },
      { q: "How fast can you come out?", a: "Same-day for emergencies, usually next-day otherwise." },
    ],
    hours: { mon_fri: "7am–7pm", sat: "8am–4pm", sun: "Closed (emergency line)", after_hours_policy: "Emergency dispatch for no-cooling/no-heat" },
    escalation: { highValueTriggers: ["no cooling", "no heat", "commercial", "full system"], transferNumber: "+15125550101", alertChannel: "sms" },
    fromNumber: "+18885550111",
    a2pStatus: "REGISTERED",
    a2pBrandEin: "47-1029384",
    consentNote: "Past-customer list from ServiceTitan export; written consent captured at point of service 2021–2024.",
  },
  {
    slug: "apex-roofing",
    name: "Apex Roofing & Exteriors",
    trade: "roofing",
    serviceArea: "Dallas–Fort Worth, TX",
    monthlyRetainer: 5500,
    pilotFee: 2500,
    kickerPerAppt: 275,
    avgJobValue: 14500,
    brandVoice: "confident, professional, reassuring",
    services: [
      { name: "Full roof replacement", priceLow: 9000, priceHigh: 28000, highTicket: true },
      { name: "Storm damage restoration", priceLow: 8000, priceHigh: 25000, highTicket: true },
      { name: "Roof repair", priceLow: 350, priceHigh: 2500 },
      { name: "Free roof inspection", priceLow: 0, priceHigh: 0 },
    ],
    faqs: [
      { q: "Do you work with insurance claims?", a: "Yes — we handle the full claim process and meet your adjuster on site." },
      { q: "What's your warranty?", a: "Up to 50-year material and 10-year workmanship warranty." },
      { q: "Do you offer free inspections?", a: "Yes, free no-obligation roof inspections, usually within 48 hours." },
    ],
    hours: { mon_fri: "7am–6pm", sat: "8am–2pm", sun: "Closed", after_hours_policy: "Storm-season callback within 1 hour" },
    escalation: { highValueTriggers: ["storm", "active leak", "insurance", "commercial"], transferNumber: "+12145550199", alertChannel: "sms" },
    fromNumber: "+18885550222",
    a2pStatus: "PENDING",
    a2pBrandEin: "82-5647382",
    consentNote: "Storm-lead + past-job list; ~60% have written consent, remainder pending re-consent.",
  },
];

// Transcript builders per outcome.
function voiceTranscript(biz: BizDef, svc: string): { role: string; content: string }[] {
  return [
    { role: "ASSISTANT", content: `Thanks for calling ${biz.name}! Quick note — I'm an AI assistant and this call may be recorded for quality. You can say 'stop' anytime to opt out. How can I help you today?` },
    { role: "USER", content: `Hi, my ${biz.trade === "roofing" ? "roof is leaking after the storm" : "AC stopped cooling last night"}.` },
    { role: "ASSISTANT", content: `I'm sorry to hear that — let's get a technician out to you. Is this for your home, and what's the address?` },
    { role: "USER", content: `Yes, home. It's pretty urgent.` },
    { role: "ASSISTANT", content: `Understood. I've got tomorrow at 9am or Thursday at 2pm — which works better?` },
    { role: "USER", content: `Tomorrow at 9 is great.` },
    { role: "ASSISTANT", content: `Perfect — you're booked for ${svc.toLowerCase()} tomorrow at 9am. You'll get a confirmation text shortly. Anything else?` },
  ];
}

function smsTranscript(biz: BizDef, svc: string, booked: boolean): { role: string; content: string }[] {
  const base = [
    { role: "ASSISTANT", content: `Hi, it's ${biz.name}. We're reaching out to past customers before the season — want us to ${biz.trade === "roofing" ? "do a free roof inspection" : "check your AC"} and get you on the schedule? Reply YES. Reply STOP to opt out.` },
  ];
  if (booked) {
    base.push(
      { role: "USER", content: `Yes please` },
      { role: "ASSISTANT", content: `Great! I've got tomorrow at 9am or Thursday at 2pm — which works?` },
      { role: "USER", content: `Thursday afternoon works` },
      { role: "ASSISTANT", content: `You're set for ${svc.toLowerCase()} Thursday at 2pm. Confirmation coming by text. Thanks!` }
    );
  } else if (chance(0.5)) {
    base.push({ role: "USER", content: pick(["Not right now thanks", "Maybe later in the year", "We moved, no longer need it"]) });
  }
  return base;
}

async function main() {
  console.log("Resetting demo data...");
  await prisma.message.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.complianceEvent.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.business.deleteMany();

  for (const def of BUSINESSES) {
    const business = await prisma.business.create({
      data: {
        slug: def.slug,
        name: def.name,
        trade: def.trade,
        phone: def.escalation.transferNumber,
        timezone: "America/Chicago",
        serviceArea: def.serviceArea,
        hours: JSON.stringify(def.hours),
        brandVoice: def.brandVoice,
        services: JSON.stringify(def.services),
        faqs: JSON.stringify(def.faqs),
        escalation: JSON.stringify(def.escalation),
        monthlyRetainer: def.monthlyRetainer,
        pilotFee: def.pilotFee,
        kickerPerAppt: def.kickerPerAppt,
        avgJobValue: def.avgJobValue,
        a2pStatus: def.a2pStatus,
        a2pBrandEin: def.a2pBrandEin,
        fromNumber: def.fromNumber,
        consentNote: def.consentNote,
      },
    });

    const highTicketSvcs = def.services.filter((s) => s.highTicket);
    const allSvcs = def.services.filter((s) => s.priceHigh > 0);
    const leadCount = 52;
    let booked = 0;
    let held = 0;
    let recovered = 0;

    for (let i = 0; i < leadCount; i++) {
      const firstName = pick(FIRST);
      const lastName = pick(LAST);
      const ph = phone(i + (def.slug === "apex-roofing" ? 1000 : 0));

      // Consent distribution: most of the active list written/reconsented; some need re-consent; a few opted out.
      let consentStatus: string;
      const r = rand();
      if (def.slug === "apex-roofing") {
        consentStatus = r < 0.55 ? "WRITTEN" : r < 0.62 ? "RECONSENTED" : r < 0.9 ? "IMPLIED" : r < 0.95 ? "UNKNOWN" : "OPTED_OUT";
      } else {
        consentStatus = r < 0.72 ? "WRITTEN" : r < 0.8 ? "RECONSENTED" : r < 0.92 ? "IMPLIED" : r < 0.97 ? "UNKNOWN" : "OPTED_OUT";
      }

      const dncStatus = consentStatus === "OPTED_OUT" ? "UNCHECKED" : simulateDncScrub(ph);
      const reassignedStatus = consentStatus === "OPTED_OUT" ? "UNCHECKED" : simulateReassignedScrub(ph);
      const smsEligible =
        (consentStatus === "WRITTEN" || consentStatus === "RECONSENTED") &&
        dncStatus === "CLEAR" &&
        reassignedStatus === "CLEAR";

      const lead = await prisma.lead.create({
        data: {
          businessId: business.id,
          firstName,
          lastName,
          phone: ph,
          email: chance(0.6) ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com` : "",
          source: pick(["Past customer 2022", "Past customer 2023", "Maintenance plan (lapsed)", "Storm lead 2023", "Website form", "Missed call"]),
          tags: JSON.stringify(consentStatus === "OPTED_OUT" ? ["opted-out"] : chance(0.3) ? ["dormant"] : []),
          consentStatus,
          consentSource: consentStatus === "WRITTEN" ? "Point-of-service form" : consentStatus === "RECONSENTED" ? "SMS re-consent (YES)" : consentStatus === "IMPLIED" ? "Provided number on past job" : "",
          consentTimestamp: consentStatus === "UNKNOWN" ? null : daysAgo(Math.floor(rand() * 700) + 30),
          consentChannel: consentStatus === "RECONSENTED" ? "sms" : consentStatus === "WRITTEN" ? "paper" : "voice",
          dncStatus,
          reassignedStatus,
          smsEligible,
        },
      });

      // Compliance events for scrubbed/reconsented leads.
      if (consentStatus === "RECONSENTED") {
        await prisma.complianceEvent.create({ data: { businessId: business.id, leadId: lead.id, type: "RECONSENT_CONFIRMED", detail: "Customer replied YES to human-sent re-consent text." } });
      }
      if (dncStatus !== "UNCHECKED") {
        await prisma.complianceEvent.create({ data: { businessId: business.id, leadId: lead.id, type: "DNC_SCRUB", detail: dncStatus === "ON_DNC" ? "Match on National DNC — suppressed." : "Clear against National DNC." } });
      }
      if (consentStatus === "OPTED_OUT") {
        await prisma.complianceEvent.create({ data: { businessId: business.id, leadId: lead.id, type: "OPT_OUT", detail: "Replied STOP — suppressed permanently." } });
      }

      // Some leads have an AI conversation.
      const hasConvo = chance(0.62) && consentStatus !== "OPTED_OUT";
      if (!hasConvo) continue;

      const isVoice = chance(0.45);
      const willBook = chance(isVoice ? 0.58 : 0.32); // inbound voice converts higher than reactivation
      // Bookings skew toward the money jobs (replacement/restoration); browsing/repairs stay cheaper.
      const svc =
        willBook && highTicketSvcs.length && chance(0.62)
          ? pick(highTicketSvcs)
          : pick(allSvcs);
      const qualified = willBook || chance(0.45);

      const transcript = isVoice ? voiceTranscript(def, svc.name) : smsTranscript(def, svc.name, willBook);
      const createdAt = daysAgo(Math.floor(rand() * 55) + 1);
      const cOutcome = willBook ? "BOOKED" : qualified ? pick(["CALLBACK", "NOT_INTERESTED"]) : pick(["NOT_INTERESTED", "NO_ANSWER"]);
      const reasonMap: Record<string, string> = { BOOKED: "booked", CALLBACK: "info_only", NOT_INTERESTED: "not_interested", NO_ANSWER: "" };
      const cSentiment = willBook ? "positive" : qualified ? (chance(0.5) ? "neutral" : "positive") : (chance(0.4) ? "negative" : "neutral");

      const convo = await prisma.conversation.create({
        data: {
          businessId: business.id,
          leadId: lead.id,
          channel: isVoice ? "VOICE" : "SMS",
          direction: isVoice ? "INBOUND" : "OUTBOUND",
          status: "COMPLETED",
          qualified,
          outcome: cOutcome,
          sentiment: cSentiment,
          outcomeReason: reasonMap[cOutcome] ?? "",
          summary: willBook
            ? `${isVoice ? "Inbound call" : "Reactivation text"}: ${svc.name} booked.`
            : qualified
            ? `Qualified but not booked (${svc.name}).`
            : `No booking.`,
          recordingUrl: isVoice ? `https://recordings.demo/${convo_id()}.mp3` : "",
          durationSec: isVoice ? 90 + Math.floor(rand() * 180) : 0,
          createdAt,
          messages: {
            create: transcript.map((m, idx) => ({
              role: m.role,
              content: m.content,
              createdAt: new Date(createdAt.getTime() + idx * 30_000),
            })),
          },
        },
      });

      if (!willBook) continue;

      // Build the booking + walk it through the funnel.
      const isHigh = svc.highTicket === true;
      const estimatedValue = Math.round(svc.priceLow + rand() * (svc.priceHigh - svc.priceLow));
      const scheduledAt = chance(0.35) ? daysAhead(Math.floor(rand() * 14) + 1) : daysAgo(Math.floor(rand() * 40) + 1);
      const inFuture = scheduledAt.getTime() > Date.now();

      // Status walk: future -> BOOKED/CONFIRMED; past -> HELD (~60%) / NO_SHOW / CANCELLED.
      let status: string;
      let revenue = 0;
      let heldAt: Date | null = null;
      let kickerCharged = false;
      if (inFuture) {
        status = chance(0.6) ? "CONFIRMED" : "BOOKED";
      } else {
        const o = rand();
        if (o < 0.62) {
          status = "HELD";
          heldAt = scheduledAt;
          // Held jobs that close into revenue (~85%); closed value lands near the estimate.
          revenue = chance(0.85) ? Math.round(estimatedValue * (0.9 + rand() * 0.2)) : 0;
          kickerCharged = isHigh && def.kickerPerAppt > 0;
        } else if (o < 0.85) {
          status = "NO_SHOW";
        } else {
          status = "CANCELLED";
        }
      }

      booked++;
      if (status === "HELD") {
        held++;
        recovered += revenue;
      }

      await prisma.booking.create({
        data: {
          businessId: business.id,
          leadId: lead.id,
          conversationId: convo.id,
          service: svc.name,
          jobType: svc.name,
          estimatedValue,
          isHighTicket: isHigh,
          source: isVoice ? "INBOUND_VOICE" : "REACTIVATION",
          scheduledAt,
          status,
          heldAt,
          revenue,
          kickerCharged,
          remindersSent: status === "HELD" || status === "NO_SHOW" ? 3 : status === "CONFIRMED" ? 2 : 1,
          createdAt,
        },
      });
    }

    // Mark a reactivation campaign scrub event at the business level.
    await prisma.complianceEvent.create({
      data: { businessId: business.id, type: "REASSIGNED_SCRUB", detail: "Pre-campaign FCC Reassigned-Numbers DB scrub completed for active list." },
    });
    await prisma.complianceEvent.create({
      data: { businessId: business.id, type: "A2P", detail: `A2P 10DLC: ${def.a2pStatus} (Standard Brand, client EIN ${def.a2pBrandEin}).` },
    });

    console.log(`Seeded ${def.name}: ${leadCount} leads, ${booked} booked, ${held} held, $${recovered.toLocaleString()} recovered.`);
  }

  console.log("Seed complete.");
}

let _cid = 0;
function convo_id() {
  return (1000 + _cid++).toString(36);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

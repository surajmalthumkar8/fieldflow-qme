import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveBusinessId } from "@/lib/session";
import {
  isSmsEligible,
  simulateDncScrub,
  simulateReassignedScrub,
} from "@/lib/compliance";
import type { ConsentStatus } from "@/lib/types";

// Re-run National DNC + FCC Reassigned-Numbers scrubs across the whole active
// list, recompute SMS eligibility, and log the campaign-level events.
export async function POST() {
  const businessId = await getActiveBusinessId();
  if (!businessId) {
    return NextResponse.json({ ok: false, error: "No active business" }, { status: 400 });
  }

  let scrubbed = 0;
  let onDnc = 0;
  let reassigned = 0;
  let eligible = 0;

  try {
  const leads = await prisma.lead.findMany({ where: { businessId } });

  for (const lead of leads) {
    // Opted-out leads stay suppressed — never scrub or message them.
    if (lead.consentStatus === "OPTED_OUT") continue;

    const dncStatus = simulateDncScrub(lead.phone);
    const reassignedStatus = simulateReassignedScrub(lead.phone);
    const smsEligible = isSmsEligible({
      consentStatus: lead.consentStatus as ConsentStatus,
      dncStatus,
      reassignedStatus,
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { dncStatus, reassignedStatus, smsEligible },
    });

    scrubbed++;
    if (dncStatus === "ON_DNC") onDnc++;
    if (reassignedStatus === "REASSIGNED") reassigned++;
    if (smsEligible) eligible++;
  }

  await prisma.complianceEvent.create({
    data: {
      businessId,
      type: "DNC_SCRUB",
      detail: `Pre-campaign National DNC scrub: ${scrubbed} numbers checked, ${onDnc} suppressed.`,
    },
  });
  await prisma.complianceEvent.create({
    data: {
      businessId,
      type: "REASSIGNED_SCRUB",
      detail: `Pre-campaign FCC Reassigned-Numbers DB scrub: ${scrubbed} numbers checked, ${reassigned} suppressed.`,
    },
  });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Scrub failed", detail: String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, scrubbed, onDnc, reassigned, eligible });
}

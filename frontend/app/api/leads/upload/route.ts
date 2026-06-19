import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveBusinessId } from "@/lib/session";
import {
  isSmsEligible,
  simulateDncScrub,
  simulateReassignedScrub,
} from "@/lib/compliance";
import type { ConsentStatus } from "@/lib/types";

interface UploadRow {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  source?: string;
  consent?: string;
}

// Map the CSV `consent` string (written|implied|unknown|opted_out) to a ConsentStatus.
function mapConsent(raw: string | undefined): ConsentStatus {
  const v = (raw ?? "").trim().toLowerCase();
  switch (v) {
    case "written":
      return "WRITTEN";
    case "reconsented":
      return "RECONSENTED";
    case "implied":
      return "IMPLIED";
    case "opted_out":
    case "opted out":
    case "optout":
      return "OPTED_OUT";
    default:
      return "UNKNOWN";
  }
}

export async function POST(req: Request) {
  const businessId = await getActiveBusinessId();
  if (!businessId) {
    return NextResponse.json({ ok: false, error: "No active business" }, { status: 400 });
  }

  let body: { rows?: UploadRow[] };
  try {
    body = (await req.json()) as { rows?: UploadRow[] };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) {
    // Empty file / no parseable rows — not an error, just nothing to import.
    return NextResponse.json({ ok: true, created: 0, eligible: 0, blocked: 0, skipped: 0 });
  }

  let created = 0;
  let eligible = 0;
  let blocked = 0;
  let skipped = 0; // rows skipped (empty, missing phone, or malformed)

  try {
  for (const row of rows) {
    // Tolerate missing/malformed rows and rows without a phone — skip + count.
    const phone =
      row && typeof row === "object" ? (row.phone ?? "").trim() : "";
    if (!phone) {
      skipped++;
      continue; // phone is required to scrub + message
    }

    const firstName = (row.firstName ?? "").trim();
    const lastName = (row.lastName ?? "").trim();
    const email = (row.email ?? "").trim();
    const source = (row.source ?? "CSV import").trim() || "CSV import";
    const consentStatus = mapConsent(row.consent);

    // Opted-out leads are never scrubbed/messaged — suppress permanently.
    const dncStatus =
      consentStatus === "OPTED_OUT" ? "UNCHECKED" : simulateDncScrub(phone);
    const reassignedStatus =
      consentStatus === "OPTED_OUT" ? "UNCHECKED" : simulateReassignedScrub(phone);

    const smsEligible = isSmsEligible({ consentStatus, dncStatus, reassignedStatus });

    const lead = await prisma.lead.create({
      data: {
        businessId,
        firstName,
        lastName,
        phone,
        email,
        source,
        tags: JSON.stringify(consentStatus === "OPTED_OUT" ? ["opted-out"] : []),
        consentStatus,
        consentSource:
          consentStatus === "WRITTEN"
            ? "CSV import (written consent asserted)"
            : consentStatus === "IMPLIED"
            ? "Provided number on past job"
            : "",
        consentTimestamp: consentStatus === "UNKNOWN" ? null : new Date(),
        consentChannel: consentStatus === "WRITTEN" ? "paper" : "",
        dncStatus,
        reassignedStatus,
        smsEligible,
      },
    });

    // Log the scrub as a retained compliance event (5-year trail).
    if (dncStatus !== "UNCHECKED") {
      await prisma.complianceEvent.create({
        data: {
          businessId,
          leadId: lead.id,
          type: "DNC_SCRUB",
          detail:
            dncStatus === "ON_DNC"
              ? "Match on National DNC — suppressed."
              : reassignedStatus === "REASSIGNED"
              ? "Clear on DNC; flagged on FCC Reassigned-Numbers DB — suppressed."
              : "Clear against National DNC + FCC Reassigned-Numbers DB.",
        },
      });
    }
    if (consentStatus === "OPTED_OUT") {
      await prisma.complianceEvent.create({
        data: {
          businessId,
          leadId: lead.id,
          type: "OPT_OUT",
          detail: "Imported as opted-out — suppressed permanently.",
        },
      });
    }

    created++;
    if (smsEligible) eligible++;
    else blocked++;
  }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Failed to import leads", detail: String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, created, eligible, blocked, skipped });
}

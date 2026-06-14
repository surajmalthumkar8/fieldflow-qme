"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  Loader2,
  MailCheck,
  PhoneOff,
  Send,
  X,
} from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { initials, phoneFmt } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { LeadRow } from "./types";
import { CONSENT_META, needsReconsent } from "./consent";

type FilterKey =
  | "all"
  | "eligible"
  | "needs_reconsent"
  | "opted_out"
  | "flagged";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "eligible", label: "SMS-eligible" },
  { key: "needs_reconsent", label: "Needs re-consent" },
  { key: "flagged", label: "DNC / reassigned" },
  { key: "opted_out", label: "Opted out" },
];

function matches(lead: LeadRow, filter: FilterKey): boolean {
  switch (filter) {
    case "eligible":
      return lead.smsEligible;
    case "needs_reconsent":
      return needsReconsent(lead.consentStatus);
    case "opted_out":
      return lead.consentStatus === "OPTED_OUT";
    case "flagged":
      return lead.dncStatus !== "CLEAR" && lead.dncStatus !== "UNCHECKED"
        ? true
        : lead.reassignedStatus !== "CLEAR" && lead.reassignedStatus !== "UNCHECKED";
    default:
      return true;
  }
}

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const visible = React.useMemo(
    () => leads.filter((l) => matches(l, filter)),
    [leads, filter]
  );

  async function act(leadId: string, action: "send" | "confirm") {
    setPendingId(leadId);
    setToast(null);
    try {
      const resp = await fetch("/api/leads/reconsent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, action }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        setToast(json.error ?? "Action failed.");
      } else {
        setToast(
          action === "send"
            ? "Re-consent text sent (logged to audit trail)."
            : "Marked re-consented — eligibility recomputed."
        );
        router.refresh();
      }
    } catch (err) {
      setToast(String(err));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = leads.filter((l) => matches(l, f.key)).length;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                  filter === f.key
                    ? "bg-signal-600 text-white ring-signal-600"
                    : "bg-white text-ink-600 ring-ink-200 hover:bg-ink-50"
                )}
              >
                {f.label}
                <span className="num ml-1.5 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        {toast ? (
          <span className="text-xs font-medium text-signal-600">{toast}</span>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<MailCheck className="h-7 w-7" />}
          title="No leads in this view"
          description="Upload a consented CSV or switch filters."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="py-2 pr-4 font-medium">Lead</th>
                <th className="py-2 pr-4 font-medium">Phone</th>
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 font-medium">Consent</th>
                <th className="py-2 pr-4 font-medium">Scrub</th>
                <th className="py-2 pr-4 font-medium">SMS</th>
                <th className="py-2 pr-0 text-right font-medium">Re-consent gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((lead) => {
                const meta = CONSENT_META[lead.consentStatus];
                const onDnc = lead.dncStatus === "ON_DNC";
                const reassigned = lead.reassignedStatus === "REASSIGNED";
                const isPending = pendingId === lead.id;
                const canReconsent = needsReconsent(lead.consentStatus);
                return (
                  <tr key={lead.id} className="align-top text-ink-700 hover:bg-ink-50/60">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal-50 text-xs font-semibold text-signal-700 ring-1 ring-inset ring-signal-200">
                          {initials(lead.firstName, lead.lastName)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-ink-900">
                            {`${lead.firstName} ${lead.lastName}`.trim() || "—"}
                          </div>
                          {lead.email ? (
                            <div className="truncate text-xs text-ink-400">{lead.email}</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="num py-3 pr-4 whitespace-nowrap text-ink-600">
                      {phoneFmt(lead.phone)}
                    </td>
                    <td className="py-3 pr-4 text-ink-500">{lead.source || "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {onDnc ? (
                          <Badge tone="danger">
                            <Ban className="h-3 w-3" /> On DNC
                          </Badge>
                        ) : null}
                        {reassigned ? (
                          <Badge tone="danger">
                            <PhoneOff className="h-3 w-3" /> Reassigned
                          </Badge>
                        ) : null}
                        {!onDnc && !reassigned ? (
                          lead.dncStatus === "CLEAR" ? (
                            <Badge tone="money">Clear</Badge>
                          ) : (
                            <Badge tone="neutral">Unchecked</Badge>
                          )
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {lead.smsEligible ? (
                        <span className="inline-flex items-center gap-1 text-money-600">
                          <Check className="h-4 w-4" />
                          <span className="text-xs font-medium">Eligible</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-ink-400"
                          title={lead.blockReasons.join(" • ")}
                        >
                          <X className="h-4 w-4" />
                          <span className="text-xs font-medium">Blocked</span>
                        </span>
                      )}
                      {!lead.smsEligible && lead.blockReasons.length ? (
                        <div className="mt-0.5 max-w-[14rem] text-[11px] leading-tight text-ink-400">
                          {lead.blockReasons.join(" • ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-0">
                      <div className="flex justify-end gap-1.5">
                        {lead.consentStatus === "OPTED_OUT" ? (
                          <span className="text-xs text-ink-400">Suppressed</span>
                        ) : canReconsent ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-2.5 py-1 text-xs"
                              disabled={isPending}
                              onClick={() => act(lead.id, "send")}
                            >
                              {isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              Send text
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              className="px-2.5 py-1 text-xs"
                              disabled={isPending}
                              onClick={() => act(lead.id, "confirm")}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Replied YES
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-money-600">PEWC on file</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

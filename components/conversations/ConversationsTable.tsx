"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  PhoneCall,
} from "lucide-react";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import {
  fmtDate,
  fmtDuration,
  outcomeLabel,
  outcomeTone,
  sentimentLabel,
} from "@/components/conversations/shared";
import { SentimentBadge } from "@/components/conversations/SentimentBadge";

export interface ConversationRow {
  id: string;
  channel: string; // VOICE | SMS
  direction: string; // INBOUND | OUTBOUND
  outcome: string;
  qualified: boolean;
  durationSec: number;
  summary: string;
  sentiment: string; // positive | neutral | negative
  leadName: string;
  hasBooking: boolean;
  createdAt: string; // ISO
}

const OUTCOME_OPTIONS = [
  "BOOKED",
  "CALLBACK",
  "ESCALATED",
  "NOT_INTERESTED",
  "NO_ANSWER",
  "OPTED_OUT",
];

const SENTIMENT_OPTIONS = ["positive", "neutral", "negative"] as const;

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
        active
          ? "bg-signal-600 text-white ring-signal-600"
          : "bg-white text-ink-600 ring-ink-200 hover:bg-ink-50"
      )}
    >
      {children}
    </button>
  );
}

export function ConversationsTable({ rows }: { rows: ConversationRow[] }) {
  const [channel, setChannel] = React.useState<"ALL" | "VOICE" | "SMS">("ALL");
  const [outcome, setOutcome] = React.useState<string>("ALL");
  const [sentiment, setSentiment] = React.useState<string>("ALL");

  const filtered = rows.filter(
    (r) =>
      (channel === "ALL" || r.channel === channel) &&
      (outcome === "ALL" || r.outcome === outcome) &&
      (sentiment === "ALL" || r.sentiment === sentiment)
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow w-16 shrink-0">Channel</span>
          {(["ALL", "VOICE", "SMS"] as const).map((c) => (
            <FilterPill key={c} active={channel === c} onClick={() => setChannel(c)}>
              {c === "ALL" ? "All" : c === "VOICE" ? "Voice" : "SMS"}
            </FilterPill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow w-16 shrink-0">Sentiment</span>
          <FilterPill active={sentiment === "ALL"} onClick={() => setSentiment("ALL")}>
            All
          </FilterPill>
          {SENTIMENT_OPTIONS.map((s) => (
            <FilterPill key={s} active={sentiment === s} onClick={() => setSentiment(s)}>
              {sentimentLabel(s)}
            </FilterPill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow w-16 shrink-0">Outcome</span>
          <FilterPill active={outcome === "ALL"} onClick={() => setOutcome("ALL")}>
            All
          </FilterPill>
          {OUTCOME_OPTIONS.map((o) => (
            <FilterPill key={o} active={outcome === o} onClick={() => setOutcome(o)}>
              {outcomeLabel(o)}
            </FilterPill>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-7 w-7" />}
          title="No conversations match"
          description="Try clearing the channel or outcome filter."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-paper-50 text-left">
                  <th className="px-4 py-2.5"><span className="eyebrow">Channel</span></th>
                  <th className="px-4 py-2.5"><span className="eyebrow">Customer</span></th>
                  <th className="px-4 py-2.5"><span className="eyebrow">Direction</span></th>
                  <th className="px-4 py-2.5"><span className="eyebrow">Outcome</span></th>
                  <th className="px-4 py-2.5"><span className="eyebrow">Sentiment</span></th>
                  <th className="px-4 py-2.5"><span className="eyebrow">Qualified</span></th>
                  <th className="px-4 py-2.5 text-right"><span className="eyebrow">Duration</span></th>
                  <th className="px-4 py-2.5"><span className="eyebrow">Date</span></th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="group cursor-pointer text-ink-700 transition-colors hover:bg-ink-50/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/conversations/${r.id}`}
                        className="flex items-center gap-2"
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg",
                            r.channel === "VOICE"
                              ? "bg-money-50 text-money-600"
                              : "bg-signal-50 text-signal-600"
                          )}
                        >
                          {r.channel === "VOICE" ? (
                            <PhoneCall className="h-3.5 w-3.5" />
                          ) : (
                            <MessageSquare className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span className="text-xs font-medium text-ink-500">
                          {r.channel === "VOICE" ? "Voice" : "SMS"}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/conversations/${r.id}`} className="block">
                        <span className="font-medium text-ink-900">{r.leadName}</span>
                        {r.summary ? (
                          <span className="mt-0.5 block max-w-xs truncate text-xs text-ink-400">
                            {r.summary}
                          </span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                        {r.direction === "INBOUND" ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-money-500" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-signal-500" />
                        )}
                        {r.direction === "INBOUND" ? "Inbound" : "Outbound"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={outcomeTone(r.outcome)}>
                        {outcomeLabel(r.outcome)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <SentimentBadge sentiment={r.sentiment} />
                    </td>
                    <td className="px-4 py-3">
                      {r.qualified ? (
                        <CheckCircle2 className="h-4 w-4 text-money-600" />
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="num text-ink-500">
                        {r.channel === "VOICE" ? fmtDuration(r.durationSec) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="num text-ink-500">{fmtDate(r.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/conversations/${r.id}`}
                        aria-label="View transcript"
                        className="inline-flex text-ink-300 group-hover:text-signal-600"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

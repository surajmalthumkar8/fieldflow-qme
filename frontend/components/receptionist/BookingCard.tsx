"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2, MessagesSquare } from "lucide-react";
import { usd } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui/primitives";
import type { BookingInfo } from "./types";

export function BookingCard({ booking }: { booking: BookingInfo }) {
  const when = new Date(booking.scheduledAt);
  const whenLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(when);

  return (
    <Card className="animate-fade-in border-money-400/50 bg-money-50/60 p-5 shadow-pop">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-money-500 text-white">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-900">Booking confirmed</h3>
            {booking.isHighTicket ? (
              <Badge tone="money">High-ticket · $5k+</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-ink-500">
            The AI just booked this job — it&apos;s already attributed on your dashboard.
          </p>

          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Service" value={booking.service} />
            <Field
              label="Scheduled"
              value={
                <span className="inline-flex items-center gap-1">
                  <CalendarCheck className="h-3.5 w-3.5 text-money-600" />
                  <span className="num">{whenLabel}</span>
                </span>
              }
            />
            <Field
              label="Est. value"
              value={<span className="num text-money-700">{usd(booking.estimatedValue)}</span>}
            />
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard">
              <Button variant="primary">
                See it in attribution
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/conversations">
              <Button variant="secondary">
                <MessagesSquare className="h-4 w-4" />
                View transcript
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

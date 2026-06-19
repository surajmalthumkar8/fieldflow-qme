"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarDays, Download, Loader2, Video } from "lucide-react";

interface Slot {
  start: string;
  label: string;
}

const TZS = [
  { value: "America/New_York", label: "New York (ET)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
];

// Guess a sensible default tz for the visitor (only NY / India are supported).
function defaultTz(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return z.startsWith("Asia/") ? "Asia/Kolkata" : "America/New_York";
  } catch {
    return "America/New_York";
  }
}

export function SlotPicker({
  businessId,
  businessName,
  defaultName = "",
  defaultEmail = "",
  defaultPhone = "",
  defaultTz: tzProp = "",
  after = "",
  conversationId = "",
  onBooked,
}: {
  businessId: string;
  businessName: string;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  defaultTz?: string;
  after?: string; // ISO date the visitor asked to start from ("next week" / "the 23rd")
  conversationId?: string; // links the booking to this chat thread (for the leads view)
  onBooked: (label: string, emailed: boolean) => void;
}) {
  // Default to the customer's account timezone, else guess from the browser.
  const [tz, setTz] = useState(
    TZS.some((t) => t.value === tzProp) ? tzProp : defaultTz()
  );
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(defaultEmail);
  // If we already captured an email, show a confirm row instead of a blank ask.
  const [editingEmail, setEditingEmail] = useState(!defaultEmail);
  const [bookingStart, setBookingStart] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ label: string; ics: string; emailed: boolean; meetingUrl?: string; gcalUrl?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ business_id: businessId, tz });
      if (after) qs.set("after", after);
      const r = await fetch(`/api/ai/availability?${qs.toString()}`, { cache: "no-store" });
      const data = await r.json();
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, tz, after]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pick(slot: Slot) {
    if (bookingStart) return;
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter your email so we can send the calendar invite.");
      return;
    }
    setBookingStart(slot.start);
    setError("");
    try {
      const r = await fetch("/api/ai/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          business_name: businessName,
          start: slot.start,
          tz,
          name: defaultName,
          email: email.trim(),
          phone: defaultPhone,
          conversation_id: conversationId,
        }),
      });
      const data = await r.json();
      if (r.status === 409) {
        setError(data.detail || "That time was just taken — please pick another.");
        await load(); // refresh so the taken slot disappears
        return;
      }
      if (!r.ok) {
        setError("Couldn't book that slot. Please try again.");
        return;
      }
      setDone({ label: data.label, ics: data.ics, emailed: Boolean(data.emailed), meetingUrl: data.meeting_url, gcalUrl: data.gcal_url });
      onBooked(data.label, Boolean(data.emailed));
    } catch {
      setError("Couldn't book that slot. Please try again.");
    } finally {
      setBookingStart(null);
    }
  }

  function downloadIcs() {
    if (!done) return;
    const blob = new Blob([done.ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invite.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-money-200 bg-money-50 p-4 dark:border-money-500/30 dark:bg-money-500/10">
        <div className="flex items-center gap-2 text-sm font-semibold text-money-800 dark:text-money-300">
          <CalendarCheck className="h-4 w-4" />
          Booked — {done.label}
        </div>
        <p className="mt-1 text-xs text-money-700 dark:text-money-200/80">
          {done.emailed ? `Invite emailed to ${email}. ` : ""}It's a video call — join with the link below.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {done.meetingUrl ? (
            <a
              href={done.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-signal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-signal-700"
            >
              <Video className="h-3.5 w-3.5" /> Join video call
            </a>
          ) : null}
          {done.gcalUrl ? (
            <a
              href={done.gcalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-ink-300 hover:bg-ink-50 dark:bg-ink-800 dark:text-ink-200 dark:ring-ink-600 dark:hover:bg-ink-700"
            >
              <CalendarDays className="h-3.5 w-3.5" /> Add to Google Calendar
            </a>
          ) : null}
          <button
            onClick={downloadIcs}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-money-800 ring-1 ring-money-300 hover:bg-money-100 dark:bg-ink-800 dark:text-money-200 dark:ring-money-500/40 dark:hover:bg-ink-700"
          >
            <Download className="h-3.5 w-3.5" /> .ics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
          <CalendarDays className="h-4 w-4 text-signal-500" />
          Here are some open times — pick one:
        </div>
        <div className="flex rounded-lg bg-ink-50 p-0.5 text-[11px] dark:bg-ink-800">
          {TZS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTz(t.value)}
              className={`rounded-md px-2 py-1 font-medium transition ${
                tz === t.value
                  ? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white"
                  : "text-ink-500 dark:text-ink-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Email: confirm the captured one, or ask if we don't have it. */}
      {email && !editingEmail ? (
        <p className="mt-3 text-xs text-ink-600 dark:text-ink-300">
          I&apos;ll send the invite to <span className="font-semibold">{email}</span>{" "}
          <button onClick={() => setEditingEmail(true)} className="text-signal-600 hover:underline dark:text-signal-400">
            change
          </button>
        </p>
      ) : (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email && setEditingEmail(false)}
          placeholder="your@email.com — for the calendar invite"
          className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100"
        />
      )}

      {error ? <p className="mt-2 text-xs text-danger-600 dark:text-danger-400">{error}</p> : null}

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading available times…
        </div>
      ) : slots.length === 0 ? (
        <p className="mt-3 text-xs text-ink-400">No open times right now — an agent will reach out.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <button
              key={s.start}
              onClick={() => pick(s)}
              disabled={!!bookingStart}
              className="inline-flex items-center gap-1 rounded-full border border-signal-200 bg-signal-50 px-3 py-1.5 text-xs font-medium text-signal-700 transition hover:bg-signal-100 disabled:opacity-50 dark:border-signal-500/30 dark:bg-signal-500/15 dark:text-signal-300 dark:hover:bg-signal-500/25"
            >
              {bookingStart === s.start ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

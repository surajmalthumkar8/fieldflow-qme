"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarDays, Download, Loader2 } from "lucide-react";

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
  onBooked,
}: {
  businessId: string;
  businessName: string;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  onBooked: (label: string, emailed: boolean) => void;
}) {
  const [tz, setTz] = useState(defaultTz());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(defaultEmail);
  const [bookingStart, setBookingStart] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ label: string; ics: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
        `/api/ai/availability?business_id=${encodeURIComponent(businessId)}&tz=${encodeURIComponent(tz)}`,
        { cache: "no-store" }
      );
      const data = await r.json();
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, tz]);

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
      setDone({ label: data.label, ics: data.ics });
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
      <div className="rounded-xl border border-money-200 bg-money-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-money-800">
          <CalendarCheck className="h-4 w-4" />
          Booked — {done.label}
        </div>
        <p className="mt-1 text-xs text-money-700">
          An agent will call you then. Add it to your calendar:
        </p>
        <button
          onClick={downloadIcs}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-money-800 ring-1 ring-money-300 hover:bg-money-100"
        >
          <Download className="h-3.5 w-3.5" /> Add to calendar (.ics)
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
          <CalendarDays className="h-4 w-4 text-signal-500" />
          Pick a time for your call
        </div>
        <div className="flex rounded-lg bg-ink-50 p-0.5 text-[11px]">
          {TZS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTz(t.value)}
              className={`rounded-md px-2 py-1 font-medium transition ${
                tz === t.value ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com — for the calendar invite"
        className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-400 focus:outline-none"
      />

      {error ? <p className="mt-2 text-xs text-danger-600">{error}</p> : null}

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
              className="inline-flex items-center gap-1 rounded-full border border-signal-200 bg-signal-50 px-3 py-1.5 text-xs font-medium text-signal-700 transition hover:bg-signal-100 disabled:opacity-50"
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

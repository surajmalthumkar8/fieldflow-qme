import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/cn";

// The 3-touch confirm/reminder cadence on a booking. The first `remindersSent`
// touches are filled (money / sent); the rest are pending (ink). Lifts show-rate.
const TOUCHES = [
  { label: "Confirmation", hint: "on booking" },
  { label: "Reminder", hint: "T-24h" },
  { label: "Reminder", hint: "T-2h" },
];

export function ReminderCadence({ remindersSent }: { remindersSent: number }) {
  const sent = Math.max(0, Math.min(remindersSent, TOUCHES.length));
  return (
    <div>
      <div className="flex items-stretch gap-2">
        {TOUCHES.map((t, i) => {
          const done = i < sent;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-inset",
                  done
                    ? "bg-money-50 text-money-600 ring-money-400/40"
                    : "bg-ink-50 text-ink-300 ring-ink-200"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              </span>
              <span
                className={cn(
                  "text-center text-[11px] font-semibold leading-tight",
                  done ? "text-ink-700" : "text-ink-400"
                )}
              >
                {t.label}
              </span>
              <span className="eyebrow">{t.hint}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
        <span className="num font-semibold text-money-700">{sent}</span>
        <span className="text-ink-400"> / {TOUCHES.length}</span> touches sent — the 3-touch
        cadence lifts show-rate on booked jobs.
      </p>
    </div>
  );
}

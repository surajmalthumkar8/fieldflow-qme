"use client";

import { Loader2, Mic, MicOff, PhoneCall, Volume2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/primitives";
import type { CallStatus } from "./types";

const STATUS_META: Record<
  CallStatus,
  { label: string; ring: string; dot: string }
> = {
  idle: { label: "Ready", ring: "ring-ink-200", dot: "bg-ink-300" },
  listening: {
    label: "Listening…",
    ring: "ring-signal-300",
    dot: "bg-signal-500",
  },
  thinking: { label: "Thinking…", ring: "ring-warn-300", dot: "bg-warn-500" },
  speaking: {
    label: "Speaking…",
    ring: "ring-money-300",
    dot: "bg-money-500",
  },
};

export function CallPanel({
  businessName,
  tradeLabel,
  serviceArea,
  status,
  micSupported,
  listening,
  onMicDown,
  onMicUp,
}: {
  businessName: string;
  tradeLabel: string;
  serviceArea?: string;
  status: CallStatus;
  micSupported: boolean;
  listening: boolean;
  onMicDown: () => void;
  onMicUp: () => void;
}) {
  const meta = STATUS_META[status];
  const active = status !== "idle";

  return (
    <div className="flex h-full flex-col items-center justify-between rounded-2xl border border-ink-200/70 bg-gradient-to-b from-ink-900 to-ink-800 p-6 text-white shadow-card-lg">
      <div className="w-full text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-300">
          You&apos;re calling
        </p>
        <h2 className="mt-1 text-lg font-semibold leading-tight">{businessName}</h2>
        <p className="mt-1 text-xs text-ink-300">
          {tradeLabel}
          {serviceArea ? ` · ${serviceArea}` : ""}
        </p>
      </div>

      {/* Animated call orb */}
      <div className="flex flex-col items-center gap-4 py-6">
        <div
          className={cn(
            "relative flex h-28 w-28 items-center justify-center rounded-full bg-white/10 ring-2",
            meta.ring,
            active && "animate-pulse-ring"
          )}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
            {status === "thinking" ? (
              <Loader2 className="h-8 w-8 animate-spin text-warn-300" />
            ) : status === "speaking" ? (
              <Volume2 className="h-8 w-8 text-money-300" />
            ) : (
              <PhoneCall className="h-8 w-8 text-white" />
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-100">
          <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
          {meta.label}
        </span>
      </div>

      {/* Press-to-talk mic (only if supported) */}
      <div className="w-full">
        {micSupported ? (
          <button
            type="button"
            onMouseDown={onMicDown}
            onMouseUp={onMicUp}
            onMouseLeave={listening ? onMicUp : undefined}
            onTouchStart={(e) => {
              e.preventDefault();
              onMicDown();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onMicUp();
            }}
            aria-pressed={listening}
            aria-label="Press and hold to talk"
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400",
              listening
                ? "bg-signal-500 text-white"
                : "bg-white/10 text-white hover:bg-white/20"
            )}
          >
            {listening ? (
              <>
                <MicOff className="h-4 w-4" /> Release to send
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" /> Hold to talk
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-center text-xs text-ink-300">
            <MicOff className="h-4 w-4 shrink-0" />
            Voice not supported in this browser — use the text box.
          </div>
        )}
        <p className="mt-2 text-center text-[11px] text-ink-400">
          AI discloses itself &amp; recording on the first turn (TCPA / CIPA).
        </p>
      </div>
    </div>
  );
}

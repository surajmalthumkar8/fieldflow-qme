"use client";

import * as React from "react";
import { Pause, Play, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtDuration } from "@/components/conversations/shared";

// A credible-looking call recording player. There is NO real audio — recordingUrl
// is a placeholder. This is the "recorded attribution" proof surface: a play/pause
// control, a faux CSS waveform that fills as a simulated playhead advances, the call
// duration, and the compliance disclosure caption.

// Deterministic pseudo-random bar heights so the waveform is stable across renders
// (no hydration mismatch) but still looks like real audio.
function waveform(seed: string, bars = 56): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const r = ((h >>> 0) % 1000) / 1000;
    // Bias toward the middle of the bar range so it reads as speech, not noise.
    const env = 0.35 + 0.65 * Math.sin((i / bars) * Math.PI);
    out.push(Math.round((0.18 + r * 0.82) * env * 100) / 100);
  }
  return out;
}

export function RecordingPlayer({
  seed,
  durationSec,
}: {
  seed: string;
  durationSec: number;
}) {
  const bars = React.useMemo(() => waveform(seed), [seed]);
  const total = Math.max(durationSec, 1);
  const [playing, setPlaying] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, total]);

  const progress = elapsed / total;
  const playedBars = Math.round(progress * bars.length);

  function toggle() {
    if (elapsed >= total) setElapsed(0);
    setPlaying((p) => !p);
  }

  function seek(index: number) {
    setElapsed(Math.round((index / bars.length) * total));
  }

  return (
    <div className="rounded-xl border border-flare-400/30 bg-gradient-to-br from-flare-50 to-paper-50 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause recording" : "Play recording"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-signal-600 text-white shadow-sm transition-all hover:bg-signal-700 active:scale-95"
        >
          {playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="ml-0.5 h-5 w-5" />
          )}
        </button>

        {/* Waveform */}
        <div
          className="flex h-10 flex-1 items-center gap-[2px]"
          role="presentation"
        >
          {bars.map((v, i) => {
            const played = i < playedBars;
            return (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => seek(i)}
                style={{ height: `${Math.max(v * 100, 8)}%` }}
                className={cn(
                  "min-h-[3px] w-full rounded-full transition-colors",
                  played ? "bg-signal-500" : "bg-flare-400/40 hover:bg-flare-400/70"
                )}
              />
            );
          })}
        </div>

        <span className="num shrink-0 text-xs font-semibold text-ink-600">
          {fmtDuration(elapsed)} / {fmtDuration(total)}
        </span>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-500">
        <ShieldCheck className="h-3.5 w-3.5 text-flare-600" />
        Demo recording — AI disclosure and &ldquo;this call may be recorded&rdquo; notice played
        at call start.
      </p>
    </div>
  );
}

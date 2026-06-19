"use client";

// After-Hours Audit — the outbound lead-gen hook a rep runs *live* with a
// prospect. Everything here is a CLIENT-SIDE SIMULATION ("model"): no real
// phone calls are placed. The five "test calls" and the resulting coverage
// grade are DETERMINISTIC, seeded from the prospect's phone digits, so the
// same number always grades the same way (no Math.random churn per render).
//
// Compliance note baked into the UI: the lost-revenue figure is a *modeled
// estimate*, never a guarantee of earnings (FTC banned Air.ai's owners $18M
// for promising projected revenue — we sell "booked/held jobs", not income).

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  PhoneOff,
  PhoneCall,
  PhoneIncoming,
  Voicemail,
  Play,
  Loader2,
  RotateCcw,
  ArrowRight,
  TrendingDown,
  Clock,
  CheckCircle2,
  ShieldCheck,
  CalendarCheck,
  Headphones,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  SectionLabel,
} from "@/components/ui/primitives";
import { usd, compactUsd, phoneFmt, tradeLabel } from "@/lib/format";

// ── Tunable model assumptions (conservative, labelled in the UI) ────────────
const TEST_CALLS = 5;
const BOOKING_RATE = 0.3; // share of recovered missed calls that become a booked job
const CALL_MS = 420; // stagger between simulated test calls

type Trade = "hvac" | "roofing" | "plumbing" | "electrical";
type CallStatus = "answered" | "voicemail" | "no_answer";
type Phase = "idle" | "running" | "done";

interface TestCall {
  id: number;
  label: string;
  status: CallStatus;
}

// ── Deterministic seed from the phone string (FNV-1a, stable across renders) ─
function seedFromPhone(phone: string): number {
  const digits = phone.replace(/\D/g, "") || "0";
  let h = 0x811c9dc5;
  for (let i = 0; i < digits.length; i++) {
    h ^= digits.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Tiny seeded PRNG (mulberry32) so each test call is stable but varied.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCENARIO_LABELS = [
  "Weeknight, 7:41 PM",
  "Saturday, 10:15 AM",
  "Lunch rush, 12:30 PM",
  "After close, 6:05 PM",
  "Early morning, 6:50 AM",
];

// Build the 5 deterministic test calls for a given phone number.
function buildCalls(phone: string): TestCall[] {
  const rand = mulberry32(seedFromPhone(phone));
  return Array.from({ length: TEST_CALLS }, (_, i) => {
    const r = rand();
    // Skew toward "missed" — most owner-operators don't answer after hours.
    const status: CallStatus =
      r < 0.34 ? "answered" : r < 0.74 ? "voicemail" : "no_answer";
    return { id: i, label: SCENARIO_LABELS[i] ?? `Test call ${i + 1}`, status };
  });
}

function grade(answeredPct: number): { letter: string; tone: GradeTone } {
  if (answeredPct >= 0.9) return { letter: "A", tone: "money" };
  if (answeredPct >= 0.7) return { letter: "B", tone: "money" };
  if (answeredPct >= 0.5) return { letter: "C", tone: "flare" };
  if (answeredPct >= 0.3) return { letter: "D", tone: "warn" };
  return { letter: "F", tone: "danger" };
}

type GradeTone = "money" | "flare" | "warn" | "danger";

const GRADE_RING: Record<GradeTone, string> = {
  money: "border-money-400/60 text-money-600 bg-money-50",
  flare: "border-flare-400/60 text-flare-600 bg-flare-50",
  warn: "border-warn-400/60 text-warn-600 bg-warn-50",
  danger: "border-danger-400/60 text-danger-600 bg-danger-50",
};

const STATUS_META: Record<
  CallStatus,
  { label: string; tone: "money" | "warn" | "danger"; icon: React.ReactNode }
> = {
  answered: {
    label: "Answered",
    tone: "money",
    icon: <PhoneIncoming className="h-4 w-4" />,
  },
  voicemail: {
    label: "Voicemail",
    tone: "warn",
    icon: <Voicemail className="h-4 w-4" />,
  },
  no_answer: {
    label: "No answer",
    tone: "danger",
    icon: <PhoneOff className="h-4 w-4" />,
  },
};

export function AfterHoursAudit() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState<Trade>("hvac");
  const [avgJob, setAvgJob] = useState(9500);
  const [monthlyCalls, setMonthlyCalls] = useState(220);

  const [phase, setPhase] = useState<Phase>("idle");
  const [calls, setCalls] = useState<TestCall[]>([]);
  const [revealed, setRevealed] = useState(0); // how many test calls have "rung"
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const phoneValid = phone.replace(/\D/g, "").length >= 7;
  const canRun = name.trim().length > 0 && phoneValid && phase !== "running";

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function runAudit() {
    if (!canRun) return;
    clearTimers();
    const next = buildCalls(phone);
    setCalls(next);
    setRevealed(0);
    setPhase("running");

    // Stagger the reveal of each test call, then settle into "done".
    for (let i = 0; i < next.length; i++) {
      timers.current.push(
        setTimeout(() => setRevealed(i + 1), CALL_MS * (i + 1))
      );
    }
    timers.current.push(
      setTimeout(() => setPhase("done"), CALL_MS * (next.length + 1))
    );
  }

  function reset() {
    clearTimers();
    setPhase("idle");
    setCalls([]);
    setRevealed(0);
  }

  // Derived results — only meaningful once the run completes.
  const result = useMemo(() => {
    if (!calls.length) return null;
    const answered = calls.filter((c) => c.status === "answered").length;
    const answeredPct = answered / calls.length;
    const missedPct = 1 - answeredPct;
    const missedCallsPerMo = Math.round(monthlyCalls * missedPct);
    // Modeled lost revenue: missed calls → conservative booking rate → avg job.
    const lostMid = missedCallsPerMo * BOOKING_RATE * avgJob;
    // Present as a deliberately wide, conservative RANGE (±35%), never a point promise.
    const lostLow = Math.round((lostMid * 0.65) / 100) * 100;
    const lostHigh = Math.round((lostMid * 1.35) / 100) * 100;
    return {
      answered,
      answeredPct,
      missedPct,
      missedCallsPerMo,
      lostLow,
      lostHigh,
      grade: grade(answeredPct),
    };
  }, [calls, monthlyCalls, avgJob]);

  return (
    <div className="space-y-6">
      {/* ── Dramatic intro panel: dark "diagnostic instrument" ──────────── */}
      <Card className="relative grain overflow-hidden border-ink-800 bg-ink-950 text-ink-100">
        <div className="pointer-events-none absolute inset-0 bg-blueprint opacity-50" />
        <div className="pointer-events-none absolute inset-0 bg-ink-mesh" />
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-flare-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-flare-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-flare-400" />
              </span>
              Live diagnostic · model
            </div>
            <h2 className="mt-2 font-display text-[24px] font-bold leading-tight tracking-tightest text-white">
              How many high-ticket jobs ring through to nobody?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
              We place {TEST_CALLS} simulated test calls across the hours an
              owner-operator usually misses, then grade the coverage and model
              the revenue walking out the door. It takes about ten seconds.
            </p>
          </div>
          <div className="shrink-0">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
              <div className="eyebrow text-ink-400">Test calls</div>
              <div className="num mt-1 text-[34px] font-bold leading-none text-white">
                {TEST_CALLS}
              </div>
              <div className="mt-1 text-[11px] text-ink-400">after-hours windows</div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Input + run ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Run the audit"
          subtitle="Enter the prospect's details, then place the test calls."
          action={
            phase === "done" ? (
              <Badge tone="flare">Modeled estimate</Badge>
            ) : null
          }
        />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Business name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summit Comfort Heating & Air"
                className={INPUT}
              />
            </Field>
            <Field label="Business phone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 014-2200"
                className={INPUT}
              />
            </Field>
            <Field label="Trade">
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value as Trade)}
                className={INPUT}
              >
                <option value="hvac">HVAC</option>
                <option value="roofing">Roofing</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
              </select>
            </Field>
            <Field label="Average job value">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={avgJob}
                  onChange={(e) => setAvgJob(Math.max(0, Number(e.target.value)))}
                  className={`${INPUT} num pl-7`}
                />
              </div>
            </Field>
            <Field label="Est. inbound calls / month" className="sm:col-span-2">
              <input
                type="number"
                min={0}
                step={10}
                value={monthlyCalls}
                onChange={(e) =>
                  setMonthlyCalls(Math.max(0, Number(e.target.value)))
                }
                className={`${INPUT} num`}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
            <Button
              variant="dark"
              onClick={runAudit}
              disabled={!canRun}
              type="button"
            >
              {phase === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {phase === "running" ? "Placing test calls…" : "Run the audit"}
            </Button>
            {phase !== "idle" ? (
              <Button variant="ghost" onClick={reset} type="button">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            ) : null}
            {!phoneValid && phone.length > 0 ? (
              <span className="text-xs text-ink-400">
                Enter a valid phone number to run the test calls.
              </span>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* ── Live test-call log (appears while running / after) ──────────── */}
      {phase !== "idle" ? (
        <Card>
          <CardHeader
            title="Test-call log"
            subtitle={`Simulated calls to ${
              name.trim() || "the business"
            } · ${phoneFmt(phone)}`}
            action={
              <Badge tone="neutral">
                {revealed}/{TEST_CALLS} placed
              </Badge>
            }
          />
          <CardBody className="space-y-2">
            {calls.map((c, i) => {
              const shown = i < revealed;
              const ringing = i === revealed && phase === "running";
              return (
                <CallRow key={c.id} call={c} shown={shown} ringing={ringing} />
              );
            })}
          </CardBody>
        </Card>
      ) : null}

      {/* ── Result ──────────────────────────────────────────────────────── */}
      {phase === "done" && result ? (
        <div className="space-y-6 animate-rise">
          <SectionLabel>The verdict</SectionLabel>

          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[260px_1fr]">
              {/* Big grade */}
              <div className="flex flex-col items-center justify-center gap-3 border-b border-ink-100 bg-paper-50 p-8 lg:border-b-0 lg:border-r">
                <div className="eyebrow">Coverage grade</div>
                <div
                  className={`flex h-32 w-32 items-center justify-center rounded-3xl border-2 ${
                    GRADE_RING[result.grade.tone]
                  }`}
                >
                  <span className="font-display text-[72px] font-bold leading-none tracking-tightest">
                    {result.grade.letter}
                  </span>
                </div>
                <p className="text-center text-xs text-ink-500">
                  {result.answered} of {TEST_CALLS} after-hours test calls
                  answered live
                </p>
              </div>

              {/* Stat tiles */}
              <div className="grid grid-cols-2 gap-px bg-ink-100">
                <ResultTile
                  label="Calls answered"
                  value={`${result.answered}/${TEST_CALLS}`}
                  sub="Reached a human"
                  tone="ink"
                  icon={<PhoneCall className="h-4 w-4" />}
                />
                <ResultTile
                  label="After-hours coverage"
                  value={`${Math.round(result.answeredPct * 100)}%`}
                  sub="Of test windows"
                  tone={result.answeredPct >= 0.5 ? "money" : "danger"}
                  icon={<Clock className="h-4 w-4" />}
                />
                <ResultTile
                  label="Est. missed calls / mo"
                  value={result.missedCallsPerMo.toLocaleString("en-US")}
                  sub={`~${Math.round(result.missedPct * 100)}% of ${monthlyCalls} calls`}
                  tone="warn"
                  icon={<PhoneOff className="h-4 w-4" />}
                />
                <ResultTile
                  label="Modeled lost $ / mo"
                  value={compactUsd(result.lostLow)}
                  sub="Conservative — see range below"
                  tone="danger"
                  icon={<TrendingDown className="h-4 w-4" />}
                />
              </div>
            </div>
          </Card>

          {/* Modeled lost revenue — the close, with the range + disclaimer */}
          <Card className="border-danger-200/70">
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="eyebrow text-danger-600">
                    Modeled lost revenue / month
                  </div>
                  <div className="num mt-1 text-[38px] font-bold leading-none text-danger-600">
                    {usd(result.lostLow)}
                    <span className="mx-2 text-ink-300">–</span>
                    {usd(result.lostHigh)}
                  </div>
                </div>
                <Badge tone="flare">Modeled estimate</Badge>
              </div>
              <p className="text-sm leading-relaxed text-ink-600">
                {result.missedCallsPerMo.toLocaleString("en-US")} missed{" "}
                {tradeLabel(trade)} calls × a conservative {Math.round(
                  BOOKING_RATE * 100
                )}
                % booking rate × {usd(avgJob)} average job. That is revenue the
                phone is leaving on the table every month — before you spend a
                dollar more on marketing.
              </p>
              <p className="rounded-lg bg-paper-100 px-3 py-2 text-xs leading-relaxed text-ink-500">
                This is a planning <strong>model</strong>, not a guarantee. It is
                meant to size the opportunity and start a conversation — we sell
                booked and held jobs, never projected earnings.
              </p>
            </CardBody>
          </Card>

          {/* What FieldFlow would do + CTAs */}
          <Card>
            <CardHeader
              title="What FieldFlow would do about it"
              subtitle="A managed AI front desk that turns missed calls into held jobs — with recorded attribution."
            />
            <CardBody className="space-y-5">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DoItem
                  icon={<PhoneIncoming className="h-4 w-4" />}
                  title="Answer 24/7"
                  body="Every after-hours and overflow call picked up on the first ring — nights, weekends, lunch rush."
                />
                <DoItem
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title="Qualify the job"
                  body="Sorts a $12k replacement from a $90 service call before it ever hits your calendar."
                />
                <DoItem
                  icon={<CalendarCheck className="h-4 w-4" />}
                  title="Book it"
                  body="Drops the qualified job straight onto your schedule and texts the homeowner a confirmation."
                />
                <DoItem
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Attribute it"
                  body="Every recovered call is recorded and tracked call → booked → held → dollars. You see the ROI."
                />
              </ul>

              <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
                <Link href="/receptionist">
                  <Button variant="primary" type="button">
                    <Headphones className="h-4 w-4" />
                    Hear the AI handle their call
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="secondary" type="button">
                    See the attribution dashboard
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>

          {/* Honesty / source footnote */}
          <p className="px-1 text-[11px] leading-relaxed text-ink-400">
            Modeled from industry missed-call statistics (85% of missed calls go
            to voicemail; 67% of callers try a competitor rather than leave one).
            Test calls and the coverage grade are a deterministic demonstration,
            not live calls to the business. An estimate to start a conversation —
            not a guarantee.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── Small building blocks ───────────────────────────────────────────────────

const INPUT =
  "w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-400/40";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}

function CallRow({
  call,
  shown,
  ringing,
}: {
  call: TestCall;
  shown: boolean;
  ringing: boolean;
}) {
  const meta = STATUS_META[call.status];
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-300 ${
        shown
          ? "border-ink-200/80 bg-white opacity-100"
          : ringing
            ? "border-flare-300 bg-flare-50/60 opacity-100"
            : "border-dashed border-ink-200 bg-paper-50 opacity-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            shown ? "bg-ink-100 text-ink-600" : "bg-ink-50 text-ink-300"
          }`}
        >
          {ringing ? (
            <PhoneCall className="h-4 w-4 animate-pulse text-flare-500" />
          ) : shown ? (
            meta.icon
          ) : (
            <PhoneCall className="h-4 w-4" />
          )}
        </span>
        <div>
          <div className="text-sm font-medium text-ink-800">{call.label}</div>
          <div className="text-[11px] text-ink-400">
            {ringing
              ? "Ringing…"
              : shown
                ? call.status === "answered"
                  ? "Picked up live"
                  : call.status === "voicemail"
                    ? "Rolled to voicemail"
                    : "Rang out — no answer"
                : "Queued"}
          </div>
        </div>
      </div>
      {shown ? <Badge tone={meta.tone}>{meta.label}</Badge> : null}
    </div>
  );
}

function ResultTile({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "ink" | "money" | "warn" | "danger";
  icon: React.ReactNode;
}) {
  const accent: Record<string, string> = {
    ink: "text-ink-900",
    money: "text-money-600",
    warn: "text-warn-600",
    danger: "text-danger-600",
  };
  return (
    <div className="bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className="text-ink-300">{icon}</span>
      </div>
      <div className={`num mt-2 text-[26px] font-semibold leading-none ${accent[tone]}`}>
        {value}
      </div>
      <div className="mt-1.5 text-xs text-ink-500">{sub}</div>
    </div>
  );
}

function DoItem({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-ink-100 bg-paper-50 p-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-money-50 text-money-600">
        {icon}
      </span>
      <div>
        <div className="text-sm font-semibold text-ink-900">{title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{body}</p>
      </div>
    </li>
  );
}

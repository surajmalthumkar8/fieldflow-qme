import Link from "next/link";
import {
  PhoneCall,
  Send,
  LayoutDashboard,
  ShieldCheck,
  ArrowRight,
  RadioTower,
  PhoneMissed,
  CalendarCheck,
  BadgeDollarSign,
} from "lucide-react";

const STAGES = [
  { icon: PhoneMissed, label: "Missed call", tone: "text-danger-400", note: "85% → voicemail, no callback" },
  { icon: PhoneCall, label: "AI answers", tone: "text-signal-300", note: "qualifies + books, 24/7" },
  { icon: CalendarCheck, label: "Job booked & held", tone: "text-flare-300", note: "$8–20k high-ticket" },
  { icon: BadgeDollarSign, label: "Revenue, attributed", tone: "text-money-400", note: "on the dashboard" },
];

export default function Landing() {
  return (
    <div className="grain relative min-h-screen overflow-hidden bg-ink-950 text-white">
      {/* atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-blueprint opacity-50" />
      <div className="pointer-events-none absolute inset-0 bg-ink-mesh" />
      <div className="pointer-events-none absolute -top-40 right-0 h-[480px] w-[480px] rounded-full bg-signal-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-[360px] w-[360px] rounded-full bg-money-500/10 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* nav */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-signal-500 to-signal-700">
              <RadioTower className="h-[18px] w-[18px]" />
            </div>
            <div className="leading-none">
              <div className="font-display text-[15px] font-bold tracking-tightest">FieldFlow</div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-400">
                Powered by TechAegisAI
              </div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-paper-200"
          >
            Open the dashboard
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </header>

        {/* hero */}
        <section className="pb-14 pt-12 lg:pt-20">
          <div className="animate-rise inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-flare-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-flare-400" />
            Done-for-you · HVAC &amp; roofing · built in India, sold to the US
          </div>

          <h1
            className="animate-rise mt-7 max-w-4xl font-display text-[44px] font-extrabold leading-[1.02] tracking-tightest sm:text-[66px]"
            style={{ animationDelay: "60ms" }}
          >
            We book the jobs your
            <br />
            phone keeps dropping
            <span className="text-flare-400">.</span>
            <br />
            <span className="bg-gradient-to-r from-money-300 to-money-500 bg-clip-text text-transparent">
              And we prove every dollar.
            </span>
          </h1>

          <p
            className="animate-rise mt-6 max-w-2xl text-lg leading-relaxed text-ink-300"
            style={{ animationDelay: "120ms" }}
          >
            An AI front desk that answers every call and re-engages your old customer list —
            then hands you a monthly report of exactly which{" "}
            <span className="font-semibold text-white">booked, held, high-ticket jobs</span> it
            made you. We sell recovered revenue, never &ldquo;an AI agent.&rdquo;
          </p>

          <div
            className="animate-rise mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "180ms" }}
          >
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 rounded-xl bg-signal-600 px-5 py-3 text-sm font-semibold transition hover:bg-signal-500"
            >
              See the attribution dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/receptionist"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold transition hover:bg-white/10"
            >
              <PhoneCall className="h-4 w-4 text-flare-300" /> Talk to the AI receptionist
            </Link>
          </div>
        </section>

        {/* the flow — one lead's journey, horizontal, grid-breaking */}
        <section className="border-t border-white/10 py-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
            One lead, end to end
          </div>
          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-stretch">
            {STAGES.map((s, i) => (
              <div key={s.label} className="flex items-stretch gap-3 md:flex-1">
                <div
                  className="animate-rise flex-1 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <s.icon className={`h-6 w-6 ${s.tone}`} />
                  <div className="mt-3 font-display text-sm font-bold">{s.label}</div>
                  <div className="mt-1 text-[11px] leading-snug text-ink-400">{s.note}</div>
                </div>
                {i < STAGES.length - 1 && (
                  <div className="hidden items-center justify-center text-ink-600 md:flex">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* modules */}
        <section className="grid gap-5 py-12 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: PhoneCall, t: "AI Receptionist", b: "Answers every missed call, qualifies, books — 24/7. The durable retainer.", c: "text-signal-300" },
            { icon: Send, t: "Reactivation", b: "Texts the client's own consented dormant list and books the replies. The fast pilot win.", c: "text-flare-300" },
            { icon: ShieldCheck, t: "Compliance gate", b: "Per-lead consent, A2P, DNC + reassigned-number scrubs, hard-coded disclosures. The moat.", c: "text-money-400" },
            { icon: LayoutDashboard, t: "Attribution", b: "Call → booked → HELD → $ recovered vs. monthly cost. This is the product.", c: "text-white" },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]">
              <f.icon className={`h-6 w-6 ${f.c}`} />
              <h3 className="mt-4 font-display text-base font-bold">{f.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{f.b}</p>
            </div>
          ))}
        </section>

        {/* economics */}
        <section className="grid items-center gap-10 border-t border-white/10 py-14 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tightest">
              One booked job is a no-brainer
            </h2>
            <p className="mt-3 text-ink-300">
              A booked-and-held HVAC replacement or roof is worth{" "}
              <span className="num font-semibold text-white">$8,000–$20,000</span>. The retainer
              is $2,500–$5,500/mo. One held job pays the fee several times over — and the dashboard
              proves it landed.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { k: "Recovered (demo)", v: "$64k+", c: "text-money-400" },
                { k: "Return on fee", v: "~14×", c: "text-flare-300" },
                { k: "Tools / mo", v: "$70–150", c: "text-signal-300" },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className={`num text-2xl font-bold ${s.c}`}>{s.v}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-400">{s.k}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-signal-600/15 to-money-500/10 p-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
              The binding constraint
            </div>
            <p className="mt-3 font-display text-xl font-semibold leading-snug">
              Everything keys off{" "}
              <span className="text-flare-300">one recorded, attributed, held high-ticket job.</span>{" "}
              Build the engine → dogfood it → land one pilot → prove it → templatize.
            </p>
            <Link
              href="/dashboard"
              className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold text-money-300 hover:text-money-200"
            >
              Explore the working demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        <footer className="border-t border-white/10 py-8 font-mono text-[11px] text-ink-500">
          FieldFlow — a working MVP of the TechAegisAI &ldquo;Qualified Meetings&rdquo; engine.
          Booked/held appointments only — never projected earnings.
        </footer>
      </div>
    </div>
  );
}

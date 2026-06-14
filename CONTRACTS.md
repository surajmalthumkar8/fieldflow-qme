# Build contracts (read this before writing any feature code)

This is a Next.js 15 (App Router) + TypeScript + Tailwind v3 + Prisma/SQLite app.
The **foundation already exists and is verified** — build your feature against it.
Do **NOT** modify any shared file listed under "Shared (read-only)". Only create/edit
files in your assigned paths.

## How to run / verify

- The DB is seeded (`npm run db:seed`). Two businesses exist.
- You MAY run `npx tsc --noEmit` to check types. Do **NOT** run `next build`,
  `next dev`, `npm install`, or `prisma db push` (the orchestrator owns those, and
  concurrent runs collide).
- Path alias: `@/*` maps to the project root (`qme-app/`). Import like `@/lib/db`.

## Next.js 15 gotchas (important)
- `cookies()`, `headers()`, route `params`, and `searchParams` are **async** — `await` them.
  Dynamic route signature: `export default async function Page({ params }: { params: Promise<{ id: string }> })`.
- Server Components are the default. Add `"use client"` only to files needing state/effects/handlers.
- For mutations prefer **Server Actions** (a `"use server"` async function) or a route handler
  under your assigned `app/api/...` path. After a mutation in a client component, call
  `router.refresh()` to re-fetch server data.

## Shared (read-only) — import these, never edit

### Data — `@/lib/db`
`import { prisma } from "@/lib/db"` — the Prisma client.

### Tenant — `@/lib/session`
- `getActiveBusiness()` → the current `Business | null` (use this in server components).
- `getActiveBusinessId()` → `string | null`.
- `listBusinesses()`.

### Types — `@/lib/types`
`Trade, ConsentStatus, ScrubStatus, BookingStatus, BookingSource, Channel, Direction,
MessageRole, A2PStatus, BusinessHours, ServiceItem, Faq, Escalation, BrainTurn,
BrainAction, BrainResult`.

### Config parsing — `@/lib/config`
- `parseBusiness(business)` → `{ hours, services, faqs, escalation, tags }` (parses the JSON-string columns).
- `parseTags(raw)`, `isHighTicket(value)`, `HIGH_TICKET_THRESHOLD` (5000).

### Compliance — `@/lib/compliance`
- `DISCLOSURES` (`.voiceGreetingSuffix`, `.smsFooter`, `.recordingNotice`, `.aiIdentity`).
- `isSmsEligible({consentStatus, dncStatus, reassignedStatus})` → boolean.
- `smsBlockReasons({...})` → string[] (why a lead is blocked).
- `simulateDncScrub(phone)` → "CLEAR" | "ON_DNC".
- `simulateReassignedScrub(phone)` → "CLEAR" | "REASSIGNED".
- `reconsentMessage(businessName)` → string. `A2P_STEPS` (string[]). `TCPA_PENALTY_PER_MESSAGE`.

### AI brain — `@/lib/ai/brain`
- `runBrain({ business, mode, history, userMessage })` → `Promise<BrainResult>`.
  `mode` is `"receptionist" | "reactivation"`. `history: BrainTurn[]` = `{role:"user"|"assistant", content}[]`.
  Returns `{ reply, action, qualified, engine }`. `action.type` ∈ book|escalate|opt_out|callback|none.
- `brainIsLive()` → boolean (true when ANTHROPIC_API_KEY is set).

### Integrations — `@/lib/integrations`
- `sendSms({to, from, body})` → `{ ok, mode, providerId, detail }` (live Twilio or simulated).
- `reserveSlot({preferredTime?, fromNow?})` → `{ ok, mode, scheduledAt, detail }`.

### Attribution — `@/lib/attribution`
- `summarize({ conversations, bookings, monthlyRetainer, kickerPerAppt })` → `AttributionSummary`
  with `{ conversations, qualified, booked, confirmed, held, noShow, recoveredRevenue,
  pipelineValue, highTicketHeld, bookRate, qualifyRate, holdRate, monthlyCost, kickerRevenue,
  roiMultiple, funnel: {key,label,value}[], bySource }`.

### Format — `@/lib/format`
`usd(n)`, `compactUsd(n)`, `pct(n, digits?)`, `phoneFmt(raw)`, `initials(f,l)`, `tradeLabel(trade)`.

### UI primitives — `@/components/ui/primitives`
`Card, CardHeader, CardBody, Badge (tone: neutral|signal|money|warn|danger), StatCard,
Button (variant: primary|secondary|ghost|danger), PageHeader, EmptyState`.
Use `cn(...)` from `@/lib/cn` to merge classes. Icons: `lucide-react`.

### Design tokens (Tailwind)
- Colors: `ink-*` (slate base), `signal-*` (primary blue), `money-*` (emerald), `warn-*` (amber), `danger-*` (red).
- Shadows: `shadow-card`, `shadow-card-lg`, `shadow-pop`. Animations: `animate-fade-in`, `animate-pulse-ring`.
- Page content is already wrapped in a max-w-7xl padded container by the layout — your page returns the inner content (start with `<PageHeader .../>` then a `space-y-6` stack).

## Prisma model quick reference
- **Business**: name, slug, trade, phone, timezone, serviceArea, hours(json str), brandVoice,
  services(json str), faqs(json str), escalation(json str), monthlyRetainer, pilotFee,
  kickerPerAppt, avgJobValue, a2pStatus, a2pBrandEin, fromNumber, consentNote.
- **Lead**: businessId, firstName, lastName, phone, email, source, tags(json str),
  consentStatus, consentSource, consentTimestamp(DateTime?), consentChannel,
  dncStatus, reassignedStatus, smsEligible(bool). Relations: conversations, bookings.
- **Conversation**: businessId, leadId?, channel(VOICE|SMS), direction(INBOUND|OUTBOUND),
  status, qualified(bool), outcome, summary, recordingUrl, durationSec. Relations: messages, booking.
- **Message**: conversationId, role(USER|ASSISTANT|SYSTEM), content, createdAt.
- **Booking**: businessId, leadId?, conversationId?(unique), service, jobType, estimatedValue,
  isHighTicket(bool), source, scheduledAt, status(BOOKED|CONFIRMED|HELD|NO_SHOW|CANCELLED),
  heldAt(DateTime?), revenue, kickerCharged(bool).
- **ComplianceEvent**: businessId, leadId?, type, detail, createdAt.

## Quality bar
- This is a DEMO shown to a team to explain the product. Make it polished, clear, and
  genuinely functional — not lorem-ipsum. Use real labels from the home-services domain.
- Every page must render with the seeded data and degrade gracefully when empty (use `EmptyState`).
- Keep it accessible: real buttons, labels on inputs, sensible focus styles (primitives handle most).

# 5-minute demo script (for the team)

Goal of the demo: explain **what we're building, the problem we solve, and how** — by
*showing* it, not describing it. The story is always: **booked → held → dollars, proven.**

> Setup: `npm run setup && npm run dev`, open http://localhost:3000. Use Chrome/Edge if
> you want to *talk* to the receptionist (mic); otherwise the text box works everywhere.

---

### 0. The hook (landing page, 20s)
Open `/`. Read the one line: *"We book the jobs your phone is dropping — and prove every
dollar."* Point out the framing: we sell **recovered revenue + a report**, never "an AI agent."
Click **Open the dashboard**.

### 1. The product is the proof (Dashboard, 60s)
On `/dashboard` (client = *Summit Comfort Heating & Air*):
- "**This dashboard IS the product.**" Recovered revenue **$64k+**, **~14× return** on the monthly fee.
- Walk the funnel: **Conversations → Qualified → Booked → Held**. Every held job is real money.
- Scroll to **recent held high-ticket jobs** — "this table is the case study we hand the owner."
- Switch the **Client** picker to *Apex Roofing* — same engine, different trade/pricing.

### 2. Watch the AI book a job live (AI Receptionist, 90s) — the wow
Go to `/receptionist`. The call auto-answers with the **compliance disclosure** ("I'm an AI
assistant… this call may be recorded… say stop to opt out").
- Click a quick scenario or type: **"My AC stopped cooling, can someone come tomorrow at 9am?"**
- (Mic users: press **Hold to talk** and say it.)
- The AI qualifies and **books** → a **Booking confirmed** card appears (high-ticket, $ value, time).
- Click **See it in attribution** — the job is now on the dashboard. "From call to attributed dollars, automatically."

### 3. The fast pilot win (Reactivation, 60s)
Go to `/reactivation`.
- Note the banner: **only SMS-eligible (consented + scrubbed) leads** can be messaged; N are blocked.
- Type an angle (e.g. *"pre-summer AC tune-up"*) → **Generate with AI** writes the opener (STOP footer auto-added).
- **Launch to N leads** → **Simulate replies** → watch **booked + recovered revenue** appear. "This is the dormant-list sugar-high that funds the pilot."

### 4. Why nobody can copy us cheaply (Compliance, 45s)
Go to `/compliance`. "The tech is commodity — **this** is the moat."
- Consent gate (written-consent-only), **co-sender TCPA exposure** ($500–1,500/msg), A2P under the **client's EIN**, hard-coded disclosures, 5-year audit log.

### 5. One config runs any client (Business Config, 25s)
Go to `/config`. "Change services/hours/FAQ/pricing once — the voice prompt, the texts, the
A2P campaign, and the attribution math all update. That's how 3 people run many clients."

---

### The close (say this)
"The whole business keys off **one recorded, attributed, held high-ticket job**. This MVP
builds the engine that produces it. We dogfood it on our own outreach, land one pilot, prove
it, then templatize. Everything you just saw runs today for **~$70–150/mo** in tools."

### If asked "is this real or fake?"
Real working app: real database, real conversation/booking persistence, real attribution
math, real AI logic. The **only** thing simulated for the demo is the phone carrier + the
dormant-list replies — flip on `ANTHROPIC_API_KEY` + `TWILIO_*` in `.env` and the same code
talks to live Claude and sends real texts. Nothing is mocked HTML.

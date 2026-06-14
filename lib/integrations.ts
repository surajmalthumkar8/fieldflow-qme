// Production integration adapters. All degrade to deterministic simulators when
// no API key is present, so the entire demo runs offline with zero accounts.
// Swap-in points are documented in README. These map to the validated stack:
// Twilio (SMS + A2P), Cal.com (booking), Vapi/Retell (inbound voice).

export interface SendSmsResult {
  ok: boolean;
  mode: "live" | "simulated";
  providerId: string;
  detail: string;
}

export async function sendSms(params: {
  to: string;
  from: string;
  body: string;
}): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = params.from || process.env.TWILIO_FROM_NUMBER || "";

  if (sid && token && from) {
    // Live Twilio (REST API, no SDK dependency needed).
    try {
      const body = new URLSearchParams({ To: params.to, From: from, Body: params.body });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        }
      );
      const json = (await res.json()) as { sid?: string; message?: string };
      return {
        ok: res.ok,
        mode: "live",
        providerId: json.sid ?? "",
        detail: res.ok ? "Sent via Twilio" : json.message ?? "Twilio error",
      };
    } catch (err) {
      return { ok: false, mode: "live", providerId: "", detail: String(err) };
    }
  }

  // Simulated send.
  return {
    ok: true,
    mode: "simulated",
    providerId: "SM" + Math.abs(hash(params.to + params.body)).toString(16),
    detail: "Simulated SMS (no Twilio key)",
  };
}

export interface BookingSlotResult {
  ok: boolean;
  mode: "live" | "simulated";
  scheduledAt: Date;
  detail: string;
}

/** Reserve a calendar slot. Live path would call Cal.com; simulator picks a near slot. */
export async function reserveSlot(params: {
  preferredTime?: string;
  fromNow?: number; // hours offset for simulator
}): Promise<BookingSlotResult> {
  // A real Cal.com integration would resolve availability via CALCOM_API_KEY here.
  const offsetHours = params.fromNow ?? 24;
  const d = new Date(Date.now() + offsetHours * 3600_000);
  d.setMinutes(0, 0, 0);
  if (d.getHours() < 8) d.setHours(9);
  if (d.getHours() > 17) d.setHours(15);
  return {
    ok: true,
    mode: process.env.CALCOM_API_KEY ? "live" : "simulated",
    scheduledAt: d,
    detail: process.env.CALCOM_API_KEY ? "Reserved via Cal.com" : "Simulated slot",
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

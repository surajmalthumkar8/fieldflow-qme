"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Send,
  MessageSquareReply,
  Loader2,
  CheckCircle2,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui/primitives";

interface LaunchResult {
  sent: number;
  mode: "live" | "simulated";
}
interface ReplyResult {
  replies: number;
  booked: number;
  optedOut: number;
}

export function CampaignComposer({
  eligibleCount,
  unsentCount,
  smsFooter,
}: {
  eligibleCount: number;
  unsentCount: number;
  smsFooter: string;
}) {
  const router = useRouter();
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState("");
  const [composing, setComposing] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [engine, setEngine] = useState<"live" | "demo" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compose() {
    setComposing(true);
    setToast(null);
    setError(null);
    try {
      const res = await fetch("/api/reactivation/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: offer }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        text?: string;
        engine?: "live" | "demo";
        error?: string;
      };
      if (data.ok && data.text) {
        setMessage(data.text);
        setEngine(data.engine ?? null);
      } else {
        setError(data.error ?? "Couldn't generate a draft. Try again.");
      }
    } catch {
      setError("Network error — couldn't reach the server. Try again.");
    } finally {
      setComposing(false);
    }
  }

  async function launch() {
    if (!message.trim() || unsentCount === 0) return;
    setLaunching(true);
    setToast(null);
    setError(null);
    try {
      const res = await fetch("/api/reactivation/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        sent?: number;
        error?: string;
      } & Partial<LaunchResult>;
      if (data.ok) {
        setToast(`Sent ${data.sent ?? 0} reactivation text${data.sent === 1 ? "" : "s"} to eligible leads.`);
        router.refresh();
      } else {
        setError(data.error ?? "Couldn't launch the campaign. Try again.");
      }
    } catch {
      setError("Network error — couldn't reach the server. Try again.");
    } finally {
      setLaunching(false);
    }
  }

  async function simulate() {
    setSimulating(true);
    setToast(null);
    setError(null);
    try {
      const res = await fetch("/api/reactivation/simulate-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { ok: boolean; error?: string } & Partial<ReplyResult>;
      if (data.ok) {
        setToast(
          `${data.replies ?? 0} replied · ${data.booked ?? 0} booked · ${data.optedOut ?? 0} opted out.`
        );
        router.refresh();
      } else {
        setError(data.error ?? "Couldn't simulate replies. Try again.");
      }
    } catch {
      setError("Network error — couldn't reach the server. Try again.");
    } finally {
      setSimulating(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Compose & launch campaign"
        subtitle="AI-write the opener, then text every SMS-eligible dormant lead — and watch the replies book."
        action={engine ? <Badge tone={engine === "live" ? "money" : "neutral"}>{engine === "live" ? "Live Claude" : "Demo brain"}</Badge> : null}
      />
      <CardBody className="space-y-4">
        <div>
          <label htmlFor="offer" className="block text-xs font-medium text-ink-600">
            Season / offer angle
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="offer"
              type="text"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="e.g. pre-summer AC tune-up, fall furnace check, roof inspection before storm season"
              className="flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-400/40"
            />
            <Button variant="secondary" onClick={compose} disabled={composing} type="button">
              {composing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate with AI
            </Button>
          </div>
        </div>

        <div>
          <label htmlFor="message" className="block text-xs font-medium text-ink-600">
            Opening text (editable — only sent to SMS-eligible leads)
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Generate a draft above, or write your own. The STOP footer is required and will be included."
            className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 font-mono text-sm leading-relaxed text-ink-900 placeholder:text-ink-400 focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-400/40"
          />
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-400">
            <Lock className="h-3 w-3" />
            Goes only to the <span className="num">{eligibleCount}</span> SMS-eligible lead
            {eligibleCount === 1 ? "" : "s"}. Footer &ldquo;{smsFooter}&rdquo; is appended
            automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4">
          <Button onClick={launch} disabled={launching || !message.trim() || unsentCount === 0} type="button">
            {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Launch to <span className="num">{unsentCount}</span> lead{unsentCount === 1 ? "" : "s"}
          </Button>
          <Button variant="secondary" onClick={simulate} disabled={simulating} type="button">
            {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareReply className="h-4 w-4" />}
            Simulate replies
          </Button>
          {unsentCount === 0 && eligibleCount > 0 ? (
            <span className="text-xs text-ink-400">
              All eligible leads already launched — simulate replies to book them.
            </span>
          ) : null}
          {toast ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-money-700">
              <CheckCircle2 className="h-4 w-4" />
              {toast}
            </span>
          ) : null}
          {error ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger-700">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </span>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

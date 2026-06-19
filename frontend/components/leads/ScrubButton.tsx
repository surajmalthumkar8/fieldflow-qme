"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

// Re-runs the National DNC + FCC Reassigned scrubs for the whole active list.
// Shared by the Leads page and the Compliance page.
export function ScrubButton({
  variant = "secondary",
  label = "Run DNC + Reassigned scrub",
  className,
}: {
  variant?: "primary" | "secondary";
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  async function run() {
    setBusy(true);
    setToast(null);
    try {
      const resp = await fetch("/api/leads/scrub", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        setToast(json.error ?? "Scrub failed.");
      } else {
        setToast(
          `Scrubbed ${json.scrubbed} • ${json.onDnc} on DNC • ${json.reassigned} reassigned • ${json.eligible} eligible.`
        );
        router.refresh();
      }
    } catch (err) {
      setToast(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Button type="button" variant={variant} onClick={run} disabled={busy}>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="h-4 w-4" />
        )}
        {busy ? "Scrubbing…" : label}
      </Button>
      {toast ? <span className="text-xs text-ink-500">{toast}</span> : null}
    </div>
  );
}

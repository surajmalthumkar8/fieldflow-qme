import { Badge } from "@/components/ui/primitives";

type Tone = "neutral" | "signal" | "money" | "warn" | "danger";

export interface AuditRow {
  id: string;
  type: string;
  detail: string;
  createdAt: string;
}

const TYPE_META: Record<string, { label: string; tone: Tone }> = {
  RECONSENT_SENT: { label: "Re-consent sent", tone: "signal" },
  RECONSENT_CONFIRMED: { label: "Re-consent confirmed", tone: "money" },
  DNC_SCRUB: { label: "DNC scrub", tone: "neutral" },
  REASSIGNED_SCRUB: { label: "Reassigned scrub", tone: "neutral" },
  OPT_OUT: { label: "Opt-out", tone: "danger" },
  A2P: { label: "A2P 10DLC", tone: "signal" },
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function AuditLog({ rows }: { rows: AuditRow[] }) {
  return (
    <ol className="space-y-3">
      {rows.map((r) => {
        const meta = TYPE_META[r.type] ?? { label: r.type, tone: "neutral" as Tone };
        return (
          <li key={r.id} className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-700">{r.detail}</p>
              <p className="num mt-0.5 text-xs text-ink-400">{fmt(r.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

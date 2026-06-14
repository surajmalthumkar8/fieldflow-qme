"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { CheckCircle2, Download, Loader2, Upload, XCircle } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";

interface ParsedRow {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  source?: string;
  consent?: string;
}

interface UploadResult {
  created: number;
  eligible: number;
  blocked: number;
  skipped: number;
}

const SAMPLE_CSV = `firstName,lastName,phone,email,source,consent
Maria,Reyes,+15125550148,maria.reyes@example.com,Past customer 2022,written
James,Thompson,+17375550231,,Maintenance plan (lapsed),implied
Linda,Garcia,+12145550199,linda.g@example.com,Storm lead 2023,unknown
Robert,Miller,+14695550102,,Website form,written
Patricia,Davis,+19725550175,,Missed call,opted_out
`;

export function CsvUpload() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<UploadResult | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fieldflow-leads-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    setFileName(file.name);

    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: async (res) => {
        // Send every parsed row; the server tolerates rows with no phone /
        // missing columns and reports them as `skipped`.
        const rows = (res.data || []).filter((r) => r && typeof r === "object");
        if (!rows.length) {
          setBusy(false);
          setError(
            "The file is empty or has no data rows. Expected a header row: firstName,lastName,phone,email,source,consent."
          );
          return;
        }
        try {
          const resp = await fetch("/api/leads/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows }),
          });
          const json = await resp.json();
          if (!resp.ok || !json.ok) {
            setError(json.error ?? "Upload failed.");
          } else {
            setResult({
              created: json.created ?? 0,
              eligible: json.eligible ?? 0,
              blocked: json.blocked ?? 0,
              skipped: json.skipped ?? 0,
            });
            router.refresh();
          }
        } catch (err) {
          setError(String(err));
        } finally {
          setBusy(false);
        }
      },
      error: (err) => {
        setBusy(false);
        setError(err.message);
      },
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        Upload the client&apos;s <strong>own, consented</strong> list. Columns:{" "}
        <code className="rounded bg-ink-100 px-1 py-0.5 text-xs text-ink-700">
          firstName,lastName,phone,email,source,consent
        </code>{" "}
        — <code className="rounded bg-ink-100 px-1 py-0.5 text-xs text-ink-700">consent</code>{" "}
        is one of <em>written / implied / unknown / opted_out</em>. Each row is scrubbed against the
        National DNC + FCC Reassigned-Numbers DB on import.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="Choose CSV file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {busy ? "Importing…" : "Upload CSV"}
        </Button>
        <Button type="button" variant="secondary" onClick={downloadSample} disabled={busy}>
          <Download className="h-4 w-4" />
          Download sample CSV
        </Button>
        {fileName ? <span className="text-xs text-ink-500">{fileName}</span> : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-money-400/40 bg-money-50 px-4 py-3 text-sm text-money-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            Imported <span className="num">{result.created}</span> leads.
          </span>
          <Badge tone="money">
            <span className="num">{result.eligible}</span> SMS-eligible
          </Badge>
          <Badge tone="warn">
            <span className="num">{result.blocked}</span> blocked (re-consent / scrub)
          </Badge>
          {result.skipped > 0 ? (
            <Badge tone="neutral">
              <span className="num">{result.skipped}</span> skipped (no phone)
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

interface LineItem { label: string; qty: number; unit: string; unitCost: number; amount: number }
interface Bill {
  period: string;
  symbol: string;
  plan: string;
  total: number;
  lineItems: LineItem[];
  headline?: { tagline?: string; examples?: string[] };
  status: string;
}

export default function BillingPage() {
  const [bill, setBill] = useState<Bill | null>(null);

  useEffect(() => {
    void fetch("/api/billing/me", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setBill);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Your current bill for this period. Pay-as-you-go on top of a flat plan fee." />

      {!bill ? (
        <div className="py-16 text-center text-ink-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          {/* Invoice */}
          <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
              <div>
                <div className="text-sm font-semibold text-ink-800 dark:text-ink-100">Current period · {bill.period}</div>
                <div className="text-xs text-ink-400 capitalize">{bill.plan} plan · status: {bill.status}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-ink-400">Total due</div>
                <div className="text-2xl font-semibold text-ink-900 dark:text-ink-100">{bill.symbol}{bill.total}</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-ink-100 bg-paper-50 text-left text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-400">
                <tr><th className="px-4 py-2.5 font-semibold">Item</th><th className="px-4 py-2.5 text-right font-semibold">Qty</th><th className="px-4 py-2.5 text-right font-semibold">Rate</th><th className="px-4 py-2.5 text-right font-semibold">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {bill.lineItems.map((li, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 text-ink-700 dark:text-ink-200">{li.label}</td>
                    <td className="px-4 py-2.5 text-right num text-ink-500 dark:text-ink-400">{li.qty} {li.unit}</td>
                    <td className="px-4 py-2.5 text-right num text-ink-500 dark:text-ink-400">{bill.symbol}{li.unitCost}</td>
                    <td className="px-4 py-2.5 text-right num text-ink-800 dark:text-ink-100">{bill.symbol}{li.amount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-200 dark:border-ink-700">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-ink-700 dark:text-ink-200">Total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-ink-900 dark:text-ink-100">{bill.symbol}{bill.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment + headline */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
                <CreditCard className="h-4 w-4 text-signal-500" /> Payment
              </div>
              <button disabled className="mt-3 w-full cursor-not-allowed rounded-lg bg-ink-200 px-3 py-2 text-sm font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                Connect Razorpay (coming soon)
              </button>
              <p className="mt-2 text-xs text-ink-400">Invoices and online payment will appear here once payments are enabled.</p>
            </div>
            {bill.headline?.tagline ? (
              <div className="rounded-2xl border border-signal-200 bg-signal-50/50 p-4 dark:border-signal-500/30 dark:bg-signal-500/10">
                <div className="flex items-center gap-2 text-sm font-semibold text-signal-700 dark:text-signal-300">
                  <Sparkles className="h-4 w-4" /> {bill.headline.tagline}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-ink-600 dark:text-ink-300">
                  {(bill.headline.examples ?? []).map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  HelpCircle,
  Layers,
  MessageSquareText,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
} from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type {
  BusinessHours,
  Escalation,
  Faq,
  ServiceItem,
} from "@/lib/types";

export interface ConfigFormData {
  name: string;
  trade: string;
  phone: string;
  serviceArea: string;
  timezone: string;
  brandVoice: string;
  hours: BusinessHours;
  services: ServiceItem[];
  faqs: Faq[];
  escalation: Escalation;
  monthlyRetainer: number;
  pilotFee: number;
  kickerPerAppt: number;
  avgJobValue: number;
  a2pStatus: string;
  a2pBrandEin: string;
  fromNumber: string;
  consentNote: string;
}

const TRADES = [
  { value: "hvac", label: "HVAC" },
  { value: "roofing", label: "Roofing" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
];

const HIGH_TICKET_THRESHOLD = 5000;

// --- small presentational inputs (kept local to this client component) ---

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-xs font-medium text-ink-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-ink-400">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "mt-1 block w-full rounded-xl border-0 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm ring-1 ring-inset ring-ink-200 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-signal-400";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, "appearance-none", props.className)} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, props.className)} />;
}

export function ConfigForm({ initial }: { initial: ConfigFormData }) {
  const router = useRouter();
  const [form, setForm] = React.useState<ConfigFormData>(initial);
  const [triggers, setTriggers] = React.useState(
    (initial.escalation.highValueTriggers ?? []).join(", ")
  );
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Any edit clears the "saved" confirmation.
  function patch(p: Partial<ConfigFormData>) {
    setForm((f) => ({ ...f, ...p }));
    setSaved(false);
  }
  function patchHours(p: Partial<BusinessHours>) {
    setForm((f) => ({ ...f, hours: { ...f.hours, ...p } }));
    setSaved(false);
  }
  function patchEscalation(p: Partial<Escalation>) {
    setForm((f) => ({ ...f, escalation: { ...f.escalation, ...p } }));
    setSaved(false);
  }

  // Services CRUD
  function addService() {
    patch({
      services: [
        ...form.services,
        { name: "", priceLow: 0, priceHigh: 0, highTicket: false },
      ],
    });
  }
  function updateService(i: number, p: Partial<ServiceItem>) {
    patch({
      services: form.services.map((s, idx) => (idx === i ? { ...s, ...p } : s)),
    });
  }
  function removeService(i: number) {
    patch({ services: form.services.filter((_, idx) => idx !== i) });
  }

  // FAQ CRUD
  function addFaq() {
    patch({ faqs: [...form.faqs, { q: "", a: "" }] });
  }
  function updateFaq(i: number, p: Partial<Faq>) {
    patch({ faqs: form.faqs.map((f, idx) => (idx === i ? { ...f, ...p } : f)) });
  }
  function removeFaq(i: number) {
    patch({ faqs: form.faqs.filter((_, idx) => idx !== i) });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: ConfigFormData = {
        ...form,
        escalation: {
          ...form.escalation,
          highValueTriggers: triggers
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      };
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Save failed");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Identity + voice */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-signal-600" /> Business identity
            </span>
          }
          subtitle="Feeds the voice greeting, SMS sender name, and every customer-facing line."
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <TextInput
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              required
            />
          </Field>
          <Field label="Trade">
            <Select value={form.trade} onChange={(e) => patch({ trade: e.target.value })}>
              {TRADES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Business phone">
            <TextInput
              className="num"
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              placeholder="+15125550101"
            />
          </Field>
          <Field label="Service area" hint="Zips / metro the AI confirms it covers.">
            <TextInput
              value={form.serviceArea}
              onChange={(e) => patch({ serviceArea: e.target.value })}
              placeholder="Austin, TX metro (78701–78759)"
            />
          </Field>
          <Field label="Timezone">
            <Select
              value={form.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Brand voice" hint="How the AI should sound on calls and texts.">
            <TextInput
              value={form.brandVoice}
              onChange={(e) => patch({ brandVoice: e.target.value })}
              placeholder="warm, neighborly, straight-talking"
            />
          </Field>
        </CardBody>
      </Card>

      {/* Hours */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-signal-600" /> Hours & after-hours policy
            </span>
          }
          subtitle="The AI quotes these when scheduling and decides when to escalate vs. book."
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Mon–Fri">
            <TextInput
              value={form.hours.mon_fri ?? ""}
              onChange={(e) => patchHours({ mon_fri: e.target.value })}
              placeholder="7am–7pm"
            />
          </Field>
          <Field label="Saturday">
            <TextInput
              value={form.hours.sat ?? ""}
              onChange={(e) => patchHours({ sat: e.target.value })}
              placeholder="8am–4pm"
            />
          </Field>
          <Field label="Sunday">
            <TextInput
              value={form.hours.sun ?? ""}
              onChange={(e) => patchHours({ sun: e.target.value })}
              placeholder="Closed (emergency line)"
            />
          </Field>
          <div className="sm:col-span-3">
            <Field label="After-hours policy">
              <TextInput
                value={form.hours.after_hours_policy ?? ""}
                onChange={(e) => patchHours({ after_hours_policy: e.target.value })}
                placeholder="Emergency dispatch for no-cooling / no-heat"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-signal-600" /> Services & pricing
            </span>
          }
          subtitle="Drives qualification + the high-ticket kicker. Mark $5k+ jobs high-ticket."
          action={
            <Button type="button" variant="secondary" onClick={addService}>
              <Plus className="h-4 w-4" /> Add service
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {form.services.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 px-4 py-6 text-center text-xs text-ink-400">
              No services yet. Add the jobs this contractor sells.
            </p>
          ) : (
            form.services.map((s, i) => {
              const autoHigh = s.priceHigh >= HIGH_TICKET_THRESHOLD;
              return (
                <div
                  key={i}
                  className="grid grid-cols-1 items-end gap-3 rounded-xl bg-ink-50/60 p-3 sm:grid-cols-12"
                >
                  <div className="sm:col-span-5">
                    <Field label={i === 0 ? "Service name" : ""}>
                      <TextInput
                        value={s.name}
                        onChange={(e) => updateService(i, { name: e.target.value })}
                        placeholder="AC system replacement"
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label={i === 0 ? "Price low" : ""}>
                      <TextInput
                        className="num"
                        type="number"
                        min={0}
                        value={s.priceLow}
                        onChange={(e) =>
                          updateService(i, { priceLow: Number(e.target.value) })
                        }
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label={i === 0 ? "Price high" : ""}>
                      <TextInput
                        className="num"
                        type="number"
                        min={0}
                        value={s.priceHigh}
                        onChange={(e) =>
                          updateService(i, { priceHigh: Number(e.target.value) })
                        }
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs font-medium text-ink-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-ink-300 text-signal-600 focus:ring-signal-400"
                        checked={Boolean(s.highTicket)}
                        onChange={(e) =>
                          updateService(i, { highTicket: e.target.checked })
                        }
                      />
                      High-ticket
                      {autoHigh && !s.highTicket ? (
                        <span className="text-[10px] text-warn-600">($5k+)</span>
                      ) : null}
                    </label>
                  </div>
                  <div className="flex justify-end sm:col-span-1">
                    <button
                      type="button"
                      aria-label="Remove service"
                      onClick={() => removeService(i)}
                      className="rounded-lg p-2 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>

      {/* FAQs */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-signal-600" /> FAQ knowledge
            </span>
          }
          subtitle="The RAG knowledge the AI answers from (financing, licensing, warranties)."
          action={
            <Button type="button" variant="secondary" onClick={addFaq}>
              <Plus className="h-4 w-4" /> Add FAQ
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {form.faqs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 px-4 py-6 text-center text-xs text-ink-400">
              No FAQs yet. Add the questions customers ask most.
            </p>
          ) : (
            form.faqs.map((f, i) => (
              <div key={i} className="rounded-xl bg-ink-50/60 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <Field label="Question">
                      <TextInput
                        value={f.q}
                        onChange={(e) => updateFaq(i, { q: e.target.value })}
                        placeholder="Do you offer financing?"
                      />
                    </Field>
                    <Field label="Answer">
                      <TextArea
                        rows={2}
                        value={f.a}
                        onChange={(e) => updateFaq(i, { a: e.target.value })}
                        placeholder="Yes — 0% for 18 months on approved credit."
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove FAQ"
                    onClick={() => removeFaq(i)}
                    className="mt-5 rounded-lg p-2 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* Escalation */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-signal-600" /> Escalation & alerts
            </span>
          }
          subtitle="When a high-value job comes in, where the AI hands off and alerts the owner."
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="High-value triggers"
              hint="Comma-separated phrases that force a live hand-off (e.g. no cooling, storm, commercial)."
            >
              <TextInput
                value={triggers}
                onChange={(e) => {
                  setTriggers(e.target.value);
                  setSaved(false);
                }}
                placeholder="no cooling, no heat, commercial, full system"
              />
            </Field>
          </div>
          <Field label="Transfer number">
            <TextInput
              className="num"
              value={form.escalation.transferNumber ?? ""}
              onChange={(e) => patchEscalation({ transferNumber: e.target.value })}
              placeholder="+15125550101"
            />
          </Field>
          <Field label="Alert channel">
            <Select
              value={form.escalation.alertChannel ?? "sms"}
              onChange={(e) =>
                patchEscalation({
                  alertChannel: e.target.value as "slack" | "sms",
                })
              }
            >
              <option value="sms">SMS</option>
              <option value="slack">Slack</option>
            </Select>
          </Field>
        </CardBody>
      </Card>

      {/* Commercials */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-money-600" /> Commercials
            </span>
          }
          subtitle="These numbers power the attribution math and the ROI multiple on the dashboard."
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Monthly retainer ($)">
            <TextInput
              className="num"
              type="number"
              min={0}
              value={form.monthlyRetainer}
              onChange={(e) => patch({ monthlyRetainer: Number(e.target.value) })}
            />
          </Field>
          <Field label="Pilot fee ($)">
            <TextInput
              className="num"
              type="number"
              min={0}
              value={form.pilotFee}
              onChange={(e) => patch({ pilotFee: Number(e.target.value) })}
            />
          </Field>
          <Field label="Kicker / held appt ($)" hint="$5k+ jobs only.">
            <TextInput
              className="num"
              type="number"
              min={0}
              value={form.kickerPerAppt}
              onChange={(e) => patch({ kickerPerAppt: Number(e.target.value) })}
            />
          </Field>
          <Field label="Avg job value ($)">
            <TextInput
              className="num"
              type="number"
              min={0}
              value={form.avgJobValue}
              onChange={(e) => patch({ avgJobValue: Number(e.target.value) })}
            />
          </Field>
        </CardBody>
      </Card>

      {/* Messaging / compliance */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-signal-600" /> Messaging & compliance
            </span>
          }
          subtitle="The A2P 10DLC posture and consent provenance that gate every outbound text."
        />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="A2P 10DLC status">
            <Select
              value={form.a2pStatus}
              onChange={(e) => patch({ a2pStatus: e.target.value })}
            >
              <option value="NOT_STARTED">Not started</option>
              <option value="PENDING">Pending</option>
              <option value="REGISTERED">Registered</option>
            </Select>
          </Field>
          <Field label="A2P brand EIN" hint="Client's US EIN (Standard Brand). Must be 15+ days old.">
            <TextInput
              className="num"
              value={form.a2pBrandEin}
              onChange={(e) => patch({ a2pBrandEin: e.target.value })}
              placeholder="47-1029384"
            />
          </Field>
          <Field label="From number" hint="Dedicated 10DLC number — never shared between clients.">
            <TextInput
              className="num"
              value={form.fromNumber}
              onChange={(e) => patch({ fromNumber: e.target.value })}
              placeholder="+18885550111"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Consent note"
              hint="Provenance of this client's list — the audit trail behind every text."
            >
              <TextArea
                rows={3}
                value={form.consentNote}
                onChange={(e) => patch({ consentNote: e.target.value })}
                placeholder="Past-customer list from ServiceTitan export; written consent captured at point of service 2021–2024."
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-ink-200/70 bg-white/90 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-h-[20px] text-sm" aria-live="polite">
            {error ? (
              <span className="font-medium text-danger-600">{error}</span>
            ) : saved ? (
              <Badge tone="money">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved — every layer now uses this
              </Badge>
            ) : (
              <span className="text-xs text-ink-400">
                Unsaved changes propagate to voice, SMS, A2P, and attribution on save.
              </span>
            )}
          </div>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save config"}
          </Button>
        </div>
      </div>
    </form>
  );
}

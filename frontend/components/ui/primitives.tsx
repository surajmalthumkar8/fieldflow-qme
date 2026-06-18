// Shared UI primitives — FieldFlow "control room" design language.
// Server-component safe (no "use client"). Feature code composes these.

import * as React from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div>
        <h3 className="text-[15px] font-semibold text-ink-900 dark:text-ink-50">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

type BadgeTone = "neutral" | "signal" | "money" | "warn" | "flare" | "danger";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:ring-ink-700",
  signal: "bg-signal-50 text-signal-700 ring-signal-200 dark:bg-signal-500/15 dark:text-signal-300 dark:ring-signal-500/30",
  money: "bg-money-50 text-money-700 ring-money-400/40 dark:bg-money-500/15 dark:text-money-300 dark:ring-money-500/30",
  warn: "bg-warn-50 text-warn-700 ring-warn-400/40 dark:bg-warn-500/15 dark:text-warn-300 dark:ring-warn-500/30",
  flare: "bg-flare-50 text-flare-700 ring-flare-400/40 dark:bg-flare-500/15 dark:text-flare-300 dark:ring-flare-500/30",
  danger: "bg-danger-50 text-danger-700 ring-danger-400/40 dark:bg-danger-500/15 dark:text-danger-300 dark:ring-danger-500/30",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: BadgeTone;
  icon?: React.ReactNode;
}) {
  const accent: Record<BadgeTone, string> = {
    neutral: "text-ink-900 dark:text-ink-50",
    signal: "text-signal-600",
    money: "text-money-600",
    warn: "text-warn-600",
    flare: "text-flare-600",
    danger: "text-danger-600",
  };
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {icon ? <span className="text-ink-300">{icon}</span> : null}
      </div>
      <div className={cn("num mt-2 text-[28px] font-semibold leading-none", accent[tone])}>
        {value}
      </div>
      {sub ? <div className="mt-2 text-xs text-ink-500 dark:text-ink-400">{sub}</div> : null}
    </Card>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-signal-600 text-white hover:bg-signal-700 shadow-sm",
  secondary:
    "bg-white text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-paper-100 hover:ring-ink-300 dark:bg-ink-800 dark:text-ink-100 dark:ring-ink-700 dark:hover:bg-ink-700",
  ghost: "text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
  dark: "bg-ink-900 text-white hover:bg-ink-800",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function Button({ variant = "primary", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
});

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[26px] font-bold leading-tight text-ink-900 dark:text-ink-50">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500 dark:text-ink-400">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-paper-50 px-6 py-12 text-center dark:border-ink-700 dark:bg-ink-900">
      {icon ? <div className="mb-3 text-ink-300 dark:text-ink-500">{icon}</div> : null}
      <p className="text-sm font-semibold text-ink-700 dark:text-ink-100">{title}</p>
      {description ? <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{description}</p> : null}
    </div>
  );
}

/** Section label with a hairline rule — used to structure dense pages. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="eyebrow whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-ink-200/70" />
    </div>
  );
}

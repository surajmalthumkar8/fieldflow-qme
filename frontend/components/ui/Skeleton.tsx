// Skeleton placeholders so analytics pages render instantly (structure first), then
// fill in when data arrives — the app never looks like it's hanging on a spinner.

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-md bg-ink-100 dark:bg-ink-800 ${className}`} style={style} />;
}

function Card() {
  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-2 h-7 w-16" />
    </div>
  );
}

function ChartBox({ height = 240 }: { height?: number }) {
  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-700/70 dark:bg-ink-900">
      <Skeleton className="mb-3 h-4 w-40" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

// A generic analytics-dashboard skeleton: a row of stat cards + chart blocks.
export function DashboardSkeleton({ cards = 6, charts = 1 }: { cards?: number; charts?: number }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Card key={i} />
        ))}
      </div>
      {Array.from({ length: charts }).map((_, i) => (
        <ChartBox key={i} />
      ))}
    </div>
  );
}

// A table skeleton (header + N rows).
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-700/70 dark:bg-ink-900">
      <div className="border-b border-ink-100 bg-paper-50 px-4 py-3 dark:border-ink-800 dark:bg-ink-950/40">
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="divide-y divide-ink-100 dark:divide-ink-800">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={`h-4 ${c === 0 ? "w-40" : "w-16"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

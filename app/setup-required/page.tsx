export default function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <div className="max-w-md rounded-2xl border border-ink-200 bg-white p-8 shadow-card">
        <h1 className="text-lg font-semibold text-ink-900">Seed the demo data</h1>
        <p className="mt-2 text-sm text-ink-600">
          No business found. Run the setup once to create the demo tenants and data:
        </p>
        <pre className="mt-4 rounded-xl bg-ink-900 p-4 text-xs text-ink-100">
          npm run setup
        </pre>
        <p className="mt-3 text-xs text-ink-500">
          This generates the Prisma client, creates the SQLite database, and seeds two
          realistic home-services clients with calls, texts, bookings and attribution.
        </p>
      </div>
    </div>
  );
}

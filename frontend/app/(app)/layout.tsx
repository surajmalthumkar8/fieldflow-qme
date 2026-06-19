import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { getActiveBusinessId, listBusinesses } from "@/lib/session";
import { getCurrentUser } from "@/lib/authServer";
import type { Role } from "@/lib/nav";

// The whole authenticated app is per-request (reads the session cookie + the tenant
// list from the DB). Force it dynamic so `next build` never statically prerenders these
// pages — which would run Prisma with no DATABASE_URL at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [businesses, user] = await Promise.all([listBusinesses(), getCurrentUser()]);
  if (!businesses.length) {
    // No seed yet — guide the user to set up the demo data.
    redirect("/setup-required");
  }
  const activeId = (await getActiveBusinessId()) ?? businesses[0].id;
  const role = (user?.role as Role) ?? "customer";

  return (
    <div className="flex h-screen overflow-hidden bg-paper dark:bg-ink-950">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          businesses={businesses.map((b) => ({ id: b.id, name: b.name, trade: b.trade }))}
          activeId={activeId}
          role={role}
          companyName={user?.company_name ?? ""}
        />
        <main className="flex-1 overflow-y-auto scroll-thin">
          <div className="mx-auto max-w-7xl animate-fade-in px-4 py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

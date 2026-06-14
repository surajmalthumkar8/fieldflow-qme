import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { getActiveBusinessId, listBusinesses } from "@/lib/session";
import { brainIsLive } from "@/lib/ai/brain";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const businesses = await listBusinesses();
  if (!businesses.length) {
    // No seed yet — guide the user to set up the demo data.
    redirect("/setup-required");
  }
  const activeId = (await getActiveBusinessId()) ?? businesses[0].id;

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          businesses={businesses.map((b) => ({ id: b.id, name: b.name, trade: b.trade }))}
          activeId={activeId}
          brainLive={brainIsLive()}
        />
        <main className="flex-1 overflow-y-auto scroll-thin">
          <div className="mx-auto max-w-7xl animate-fade-in px-4 py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

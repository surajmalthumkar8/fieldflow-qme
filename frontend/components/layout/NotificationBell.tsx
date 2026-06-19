"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

// A bell with an unread-message badge for the agent↔customer thread. Polls the
// unread count; links to where the messages live for this role.
export function NotificationBell({ role }: { role: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (role !== "agent" && role !== "customer") return;
    let active = true;
    const check = () =>
      fetch("/api/messaging/unread", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { unread: 0 }))
        .then((d) => { if (active) setUnread(d.unread ?? 0); })
        .catch(() => {});
    void check();
    const id = setInterval(check, 20000);
    return () => { active = false; clearInterval(id); };
  }, [role]);

  if (role !== "agent" && role !== "customer") return null;
  const href = role === "customer" ? "/my-agent" : "/leads";

  return (
    <Link
      href={href}
      title={unread ? `${unread} unread message${unread > 1 ? "s" : ""}` : "Messages"}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 transition-colors hover:text-ink-900 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:text-white"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

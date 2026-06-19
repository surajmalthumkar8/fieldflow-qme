"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, UserRound } from "lucide-react";
import { AgentChat } from "@/components/messaging/AgentChat";

// The CUSTOMER's chat with their assigned human agent. Finds the thread by who they
// are (not the current chat session). Feedback lives on its own page — kept separate.
export function CustomerAgentPanel({ businessId }: { businessId: string }) {
  const [agentConvId, setAgentConvId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [hasAgent, setHasAgent] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/messaging/my-thread", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setAgentConvId(d.conversationId ?? null);
      setHasAgent(Boolean(d.hasAgent));
      setAgentName(d.agentName ?? "");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card dark:border-ink-700 dark:bg-ink-900">
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-800 dark:border-ink-800 dark:text-ink-100">
        <UserRound className="h-4 w-4 text-signal-500" />
        {hasAgent && agentName ? `Your agent: ${agentName}` : "Your agent"}
      </div>
      {hasAgent && agentConvId ? (
        <>
          <p className="px-4 pt-3 text-xs text-money-600 dark:text-money-400">
            {agentName || "An agent"} is helping you — send them a message anytime.
          </p>
          <AgentChat conversationId={agentConvId} mode="customer" businessId={businessId} />
        </>
      ) : (
        <div className="flex items-center gap-2 p-5 text-sm text-ink-500 dark:text-ink-400">
          <MessageSquare className="h-4 w-4 text-ink-400" />
          No agent is assigned to you yet. Chat with Elara and book a call — an agent will pick you up and appear here.
        </div>
      )}
    </div>
  );
}

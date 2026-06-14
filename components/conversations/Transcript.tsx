import { Bot, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/components/conversations/shared";

export interface TranscriptMessage {
  id: string;
  role: string; // USER | ASSISTANT | SYSTEM
  content: string;
  createdAt: string; // ISO
}

// The transcript as a chat thread:
//  - ASSISTANT (the AI) on the left with a signal-tinted bubble + "AI" avatar
//  - USER (the customer) on the right with an ink-tinted bubble
//  - SYSTEM as a centered muted note
export function Transcript({ messages }: { messages: TranscriptMessage[] }) {
  if (messages.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 px-4 py-8 text-center text-xs text-ink-400">
        No transcript captured for this conversation.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((m) => {
        if (m.role === "SYSTEM") {
          return (
            <div key={m.id} className="flex justify-center">
              <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] text-ink-500">
                {m.content}
              </span>
            </div>
          );
        }

        const isAssistant = m.role === "ASSISTANT";
        return (
          <div
            key={m.id}
            className={cn(
              "flex items-end gap-2.5",
              isAssistant ? "justify-start" : "flex-row-reverse justify-start"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                isAssistant
                  ? "bg-signal-100 text-signal-700"
                  : "bg-ink-200 text-ink-700"
              )}
            >
              {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </span>
            <div className={cn("max-w-[78%]", isAssistant ? "items-start" : "items-end")}>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                  isAssistant
                    ? "rounded-bl-sm bg-signal-50 text-ink-800 ring-1 ring-inset ring-signal-100"
                    : "rounded-br-sm bg-ink-900 text-white"
                )}
              >
                {m.content}
              </div>
              <div
                className={cn(
                  "mt-1 flex items-center gap-1.5 px-1 text-[11px] text-ink-400",
                  isAssistant ? "justify-start" : "justify-end"
                )}
              >
                <span className="font-medium">{isAssistant ? "AI" : "Customer"}</span>
                <span aria-hidden>·</span>
                <span>{relativeTime(m.createdAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

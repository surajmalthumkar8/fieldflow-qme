"use client";

import { useEffect, useRef } from "react";
import { Bot, Loader2, User } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TranscriptTurn } from "./types";

export function Transcript({
  turns,
  thinking,
}: {
  turns: TranscriptTurn[];
  thinking: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the newest turn.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, thinking]);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto scroll-thin p-5">
      {turns.length === 0 && !thinking ? (
        <p className="py-10 text-center text-sm text-ink-400">
          Connecting the call…
        </p>
      ) : null}

      {turns.map((t, i) => (
        <Bubble key={i} role={t.role} content={t.content} />
      ))}

      {thinking ? (
        <div className="flex items-start gap-2">
          <Avatar role="assistant" />
          <div className="rounded-2xl rounded-tl-sm bg-ink-100 px-4 py-2.5 text-sm text-ink-500 dark:bg-ink-800 dark:text-ink-300">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}

function Bubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex items-start gap-2 animate-fade-in",
        isUser && "flex-row-reverse"
      )}
    >
      <Avatar role={role} />
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-signal-600 text-white"
            : "rounded-tl-sm bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-100"
        )}
      >
        {content}
      </div>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        isUser ? "bg-signal-100 text-signal-700" : "bg-ink-900 text-white"
      )}
      aria-hidden
    >
      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
    </div>
  );
}

// Shared client-side types for the AI receptionist demo.

import type { BrainAction } from "@/lib/types";

export type CallStatus = "idle" | "listening" | "thinking" | "speaking";

export interface TranscriptTurn {
  role: "user" | "assistant";
  content: string;
}

export interface BookingInfo {
  service: string;
  estimatedValue: number;
  scheduledAt: string; // ISO
  status: string;
  isHighTicket: boolean;
}

export interface VoiceApiResponse {
  reply: string;
  action: BrainAction;
  qualified: boolean;
  engine: "live" | "demo";
  conversationId: string;
  booking?: BookingInfo;
}

export interface Scenario {
  label: string;
  text: string;
}

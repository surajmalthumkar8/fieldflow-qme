"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in the standard lib DOM types).
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeech {
  /** True if BOTH STT and TTS feature-detect (mic can be shown). */
  supported: boolean;
  recognitionSupported: boolean;
  synthSupported: boolean;
  listening: boolean;
  startListening: (onFinal: (transcript: string) => void) => void;
  stopListening: () => void;
  speak: (text: string) => void;
  cancelSpeak: () => void;
}

/**
 * Progressive-enhancement wrapper over the Web Speech API:
 * - SpeechRecognition for press-to-talk speech-to-text
 * - speechSynthesis for speaking assistant replies aloud
 * Feature-detected; everything degrades to a no-op when unavailable so the
 * text-input path works with zero speech support.
 */
export function useSpeech(): UseSpeech {
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [synthSupported, setSynthSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef<((t: string) => void) | null>(null);

  useEffect(() => {
    setRecognitionSupported(getRecognitionCtor() !== null);
    setSynthSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startListening = useCallback((onFinal: (transcript: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    // Cancel any in-flight TTS so the mic doesn't pick it up.
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    onFinalRef.current = onFinal;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const transcript = last?.[0]?.transcript?.trim();
      if (transcript) onFinalRef.current?.(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (!text.trim()) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 1.02;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    },
    []
  );

  const cancelSpeak = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    supported: recognitionSupported && synthSupported,
    recognitionSupported,
    synthSupported,
    listening,
    startListening,
    stopListening,
    speak,
    cancelSpeak,
  };
}

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
  /** True if BOTH STT and TTS are usable (mic can be shown). */
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
 * TTS now uses the SERVER's Kokoro neural voice (natural US female) via
 * /api/ai/voice — NOT the browser's robotic speechSynthesis. We keep browser
 * SpeechRecognition for press-to-talk STT (that part sounds fine).
 */

/**
 * Progressive-enhancement wrapper over the Web Speech API:
 * - SpeechRecognition for press-to-talk speech-to-text
 * - speechSynthesis for speaking assistant replies aloud
 * Feature-detected; everything degrades to a no-op when unavailable so the
 * text-input path works with zero speech support.
 */
export function useSpeech(): UseSpeech {
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  // TTS is server-side (Kokoro), so it's always "supported" when the app runs.
  const [synthSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef<((t: string) => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    try {
      audioRef.current?.pause();
      audioRef.current = null;
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    setRecognitionSupported(getRecognitionCtor() !== null);
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      try {
        audioRef.current?.pause();
      } catch {
        /* noop */
      }
    };
  }, []);

  const startListening = useCallback((onFinal: (transcript: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    // Cancel any in-flight TTS so the mic doesn't pick it up.
    stopAudio();
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
    async (text: string) => {
      if (!text.trim()) return;
      stopAudio();
      try {
        const res = await fetch("/api/ai/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return; // no robotic fallback — silence beats the bad voice
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play().catch(() => {});
      } catch {
        /* voice unavailable — stay silent */
      }
    },
    [stopAudio]
  );

  const cancelSpeak = useCallback(() => {
    stopAudio();
  }, [stopAudio]);

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

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
  speak: (text: string, onStart?: () => void) => void;
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
  // Continuous (tap-to-talk) listening state.
  const keepListeningRef = useRef(false); // user wants to keep listening
  const bufferRef = useRef(""); // transcript accumulated across auto-restarts
  const sessionFinalRef = useRef(""); // final text from the current recognition session

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

  const finalize = useCallback(() => {
    setListening(false);
    const transcript = (bufferRef.current + " " + sessionFinalRef.current).trim();
    bufferRef.current = "";
    sessionFinalRef.current = "";
    recognitionRef.current = null;
    if (transcript) onFinalRef.current?.(transcript);
  }, []);

  // Tap-to-talk: keeps listening through pauses (auto-restarts) until the user
  // taps stop — so a thinking pause never cuts off / sends a half sentence.
  const startListening = useCallback(
    (onFinal: (transcript: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return;
      stopAudio(); // don't let the mic hear Elara's last reply
      onFinalRef.current = onFinal;
      bufferRef.current = "";
      sessionFinalRef.current = "";
      keepListeningRef.current = true;

      const begin = () => {
        const rec = new Ctor();
        rec.lang = "en-US";
        rec.interimResults = true;
        rec.continuous = true;
        rec.maxAlternatives = 1;
        rec.onresult = (e) => {
          let s = "";
          for (let i = 0; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal && r[0]?.transcript) s += r[0].transcript + " ";
          }
          sessionFinalRef.current = s.trim();
        };
        rec.onend = () => {
          // Roll this session's final text into the buffer.
          if (sessionFinalRef.current) {
            bufferRef.current = (bufferRef.current + " " + sessionFinalRef.current).trim();
            sessionFinalRef.current = "";
          }
          if (keepListeningRef.current) {
            try {
              begin(); // pause/auto-stop — keep listening
            } catch {
              finalize();
            }
          } else {
            finalize();
          }
        };
        rec.onerror = (e) => {
          const err = (e as { error?: string })?.error;
          if (err === "not-allowed" || err === "service-not-allowed") {
            keepListeningRef.current = false; // don't restart-loop on permission denial
          }
        };
        recognitionRef.current = rec;
        rec.start();
      };

      try {
        begin();
        setListening(true);
      } catch {
        setListening(false);
      }
    },
    [stopAudio, finalize]
  );

  const stopListening = useCallback(() => {
    keepListeningRef.current = false;
    try {
      recognitionRef.current?.stop(); // triggers onend -> finalize()
    } catch {
      finalize();
    }
  }, [finalize]);

  // Speak `text` with the Kokoro neural voice. `onStart` fires the moment audio
  // actually begins (or immediately if voice is unavailable) so the caller can
  // reveal the transcript line IN SYNC with the voice instead of well before it.
  const speak = useCallback(
    async (text: string, onStart?: () => void) => {
      if (!text.trim()) {
        onStart?.();
        return;
      }
      stopAudio();
      let started = false;
      const fire = () => {
        if (!started) {
          started = true;
          onStart?.();
        }
      };
      try {
        const res = await fetch("/api/ai/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          fire(); // no audio — reveal text now
          return;
        }
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = fire;
        audio.onerror = fire;
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play().catch(fire);
      } catch {
        fire();
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

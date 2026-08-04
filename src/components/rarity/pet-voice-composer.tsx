"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  speechRecognitionLanguage,
  type PetVoiceAccent,
} from "@/lib/video/accent";

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string;
    };
  }>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type PetVoiceComposerProps = {
  value: string;
  onChange: (value: string) => void;
  accent: PetVoiceAccent;
};

export function PetVoiceComposer({
  value,
  onChange,
  accent,
}: PetVoiceComposerProps) {
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [listening, setListening] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(true);
  const [speechMessage, setSpeechMessage] = useState(
    "Tap, then speak.",
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const updateLineFromSpeech = useEffectEvent((line: string) => {
    onChange(line);
  });

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      const fallbackTimer = window.setTimeout(() => {
        setSpeechAvailable(false);
        setMode("text");
        setSpeechMessage("Voice input is not available in this browser.");
      }, 0);
      return () => window.clearTimeout(fallbackTimer);
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) updateLineFromSpeech(transcript.slice(0, 120));
      setSpeechMessage("Got it. Tap to redo.");
    };
    recognition.onerror = (event) => {
      setListening(false);
      setSpeechMessage(
        event.error === "not-allowed"
          ? "Microphone access is off. Use text instead."
          : "Didn’t catch that. Try again.",
      );
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // The browser may already have closed an inactive recognition session.
      }
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = speechRecognitionLanguage(accent);
    }
  }, [accent]);

  function toggleListening() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setMode("text");
      return;
    }
    if (listening) {
      recognition.stop();
      return;
    }
    setSpeechMessage("Listening…");
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setSpeechMessage("Tap again.");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl bg-ink text-white">
      <div className="flex gap-1 border-b border-white/10 p-2" aria-label="Choose how to add your own line">
        <button
          type="button"
          className={`min-h-7 rounded-lg px-3 font-mono text-[8px] font-medium uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-35 ${mode === "voice" ? "bg-white/15 text-white" : "bg-transparent text-white/60"}`}
          onClick={() => setMode("voice")}
          disabled={!speechAvailable}
          aria-pressed={mode === "voice"}
        >
          Speak
        </button>
        <button
          type="button"
          className={`min-h-7 rounded-lg px-3 font-mono text-[8px] font-medium uppercase tracking-wide ${mode === "text" ? "bg-white/15 text-white" : "bg-transparent text-white/60"}`}
          onClick={() => setMode("text")}
          aria-pressed={mode === "text"}
        >
          Type
        </button>
      </div>

      {mode === "voice" ? (
        <div className="relative grid min-h-28 grid-cols-[52px_1fr] items-center gap-4 p-4">
          <button
            type="button"
            className="relative grid size-13 place-items-center rounded-full border-0 bg-pink p-0"
            onClick={toggleListening}
            aria-label={listening ? "Stop listening" : "Start voice input"}
            aria-pressed={listening}
          >
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-pink/60" aria-hidden="true" />}
            <svg className="relative z-10 w-6 fill-none stroke-white stroke-2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V5a3.5 3.5 0 1 0-7 0v7a3.5 3.5 0 0 0 3.5 3.5Z" />
              <path d="M5.5 11.5V12a6.5 6.5 0 0 0 13 0v-.5M12 18.5V22M8.5 22h7" />
            </svg>
          </button>
          <div className="grid gap-1">
            <strong className="text-sm">{listening ? "Listening" : "Say their line"}</strong>
            <span className="text-xs text-white/60" aria-live="polite">{speechMessage}</span>
          </div>
          {value && <p className="col-span-2 m-0 rounded-lg bg-white/10 p-3 text-sm font-bold">“{value}”</p>}
        </div>
      ) : (
        <label className="grid gap-2 p-4">
          <span className="sr-only">Their line</span>
          <textarea
            className="min-h-24 resize-none rounded-lg border border-white/20 bg-white/10 p-3 text-sm font-bold text-white outline-none placeholder:text-white/35 focus:border-purple"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="I have never been fed in my entire life."
            maxLength={120}
            rows={3}
            autoFocus
          />
          <small className="text-right font-mono text-[8px] text-white/50">{value.length}/120</small>
        </label>
      )}
    </div>
  );
}

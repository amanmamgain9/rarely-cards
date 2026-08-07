"use client";

import { useEffect, useRef, useState } from "react";
import type { MovieVoiceResult } from "@/lib/ai/gemini";

export function VoiceRecorder({
  mode,
  initialUrl,
  ensureAnalysisId,
  onResult,
}: {
  mode: "scene" | "dialogue";
  initialUrl?: string | null;
  ensureAnalysisId: () => Promise<string>;
  onResult: (result: MovieVoiceResult & { voiceUrl: string }) => void;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialUrl ?? null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  async function transcribe(blob: Blob) {
    setProcessing(true);
    setMessage("Transcribing…");
    try {
      const analysisId = await ensureAnalysisId();
      const mimeType = blob.type.split(";")[0] || "audio/webm";
      const form = new FormData();
      form.set("analysisId", analysisId);
      form.set("mode", mode);
      form.set("audio", new File([blob], `voice.${mimeType === "audio/ogg" ? "ogg" : mimeType === "audio/mp4" ? "m4a" : "webm"}`, { type: mimeType }));
      const response = await fetch("/api/movie-voice", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Recording could not be transcribed.");
      onResult(payload);
      setAudioUrl(payload.voiceUrl);
      setMessage("Recording saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recording could not be transcribed.");
    } finally {
      setProcessing(false);
    }
  }

  async function startRecording() {
    setMessage(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        setRecording(false);
        void transcribe(blob);
      };
      recorder.start();
      setRecording(true);
      setMessage("Recording…");
      stopTimerRef.current = window.setTimeout(() => recorder.stop(), 45_000);
    } catch {
      setMessage("Microphone permission is needed to record.");
    }
  }

  function stopRecording() {
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  return (
    <div className="rounded-xl border border-ink/15 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={`min-h-10 rounded-lg border-2 border-ink px-4 text-xs font-black ${recording ? "bg-pink text-white" : "bg-yellow"}`}
          type="button"
          disabled={processing}
          onClick={recording ? stopRecording : () => void startRecording()}
        >
          {recording ? "Stop recording" : audioUrl ? "Record again" : "Record voice"}
        </button>
        {audioUrl && <audio className="h-10 min-w-0 max-w-full flex-1" controls src={audioUrl} />}
      </div>
      {message && <p className="mt-2 text-xs font-bold text-ink-muted" aria-live="polite">{message}</p>}
    </div>
  );
}

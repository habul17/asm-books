"use client";

import { useEffect, useRef, useState } from "react";

/** Longest voice note: about 4 MB at the bit rate below, the file limit for notes. */
export const VOICE_NOTE_MAX_SECONDS = 10 * 60;

/** Whether this browser can record from the microphone (needs HTTPS). */
export const canRecordVoice = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** Records the microphone for a voice note; `stop` hands back the file and its length in seconds. */
export function useVoiceNote(onDone: (file: File, seconds: number) => void, onError: (message: string) => void) {
  const recorder = useRef<MediaRecorder | null>(null);
  const keep = useRef(true);
  const started = useRef(0);
  const [seconds, setSeconds] = useState<number | null>(null);

  const finish = (save: boolean) => {
    keep.current = save;
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const recording = seconds != null;
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      if (s >= VOICE_NOTE_MAX_SECONDS) finish(true);
      else setSeconds(s);
    }, 250);
    return () => clearInterval(t);
  }, [recording]);

  // Leaving the note stops the microphone without keeping the recording.
  useEffect(() => () => finish(false), []);

  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onError("The microphone is blocked. Allow it for this site in the browser settings, then try again.");
    }
    const rec = new MediaRecorder(stream, { audioBitsPerSecond: 48_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      setSeconds(null);
      if (!keep.current) return;
      const type = (rec.mimeType || chunks[0]?.type || "audio/webm").split(";")[0];
      const blob = new Blob(chunks, { type });
      if (blob.size < 1000) return onError("Nothing was recorded. Try again.");
      const length = (Date.now() - started.current) / 1000;
      const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
      const ext = type.includes("mp4") ? "m4a" : type.split("/")[1];
      onDone(new File([blob], `Voice note ${when.replace(",", "").replace(":", ".")}.${ext}`, { type }), length);
    };
    keep.current = true;
    recorder.current = rec;
    started.current = Date.now();
    rec.start(1000);
    setSeconds(0);
  };

  return { seconds, start, stop: () => finish(true), cancel: () => finish(false) };
}

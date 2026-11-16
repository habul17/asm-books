"use client";

import { MicIcon, ScanLineIcon, SquareIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { isScanMimeType, isVoiceMimeType, SCAN_MAX_BYTES } from "@/lib/bills/scan";
import { shrinkImage } from "@/lib/bills/shrink-image";

/** Room left for the form fields that travel with the file. */
const UPLOAD_MAX_BYTES = SCAN_MAX_BYTES - 100 * 1024;
/** The small copy kept in Documents: still easy to read, a fraction of the photo's size. */
const KEEP_MAX_BYTES = 450 * 1024;
const KEEP_MAX_SIDE = 1600;

type Answer<T> = { scan: T; keptId?: number; keepNote?: string; error?: never } | { error: string; scan?: never };

/** Longest recording; a long order is still well under this. */
const VOICE_MAX_SECONDS = 120;

/** Whether this browser can record from the microphone (needs HTTPS). */
const canRecord = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
const noSubscribe = () => () => {};

/** Records the microphone; `stop` hands back the recording, `cancel` drops it. */
function useVoice(onDone: (file: File) => void, onError: (message: string) => void) {
  const recorder = useRef<MediaRecorder | null>(null);
  const keep = useRef(true);
  const [seconds, setSeconds] = useState<number | null>(null);

  const finish = (save: boolean) => {
    keep.current = save;
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  useEffect(() => {
    if (seconds == null) return;
    if (seconds >= VOICE_MAX_SECONDS) {
      finish(true);
      return;
    }
    const t = setTimeout(() => setSeconds((s) => (s == null ? s : s + 1)), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  // Leaving the page stops the microphone.
  useEffect(() => () => finish(false), []);

  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onError("The microphone is blocked. Allow it for this site in the browser settings, then try again.");
    }
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      setSeconds(null);
      if (!keep.current) return;
      // "audio/webm;codecs=opus" → "audio/webm": the reader wants the plain type.
      const type = (rec.mimeType || chunks[0]?.type || "audio/webm").split(";")[0];
      const blob = new Blob(chunks, { type });
      if (blob.size < 1000) return onError("Nothing was heard. Press Speak and talk a little louder.");
      onDone(new File([blob], `voice.${type.split("/")[1]}`, { type }));
    };
    keep.current = true;
    recorder.current = rec;
    rec.start();
    setSeconds(0);
  };

  return { seconds, start, stop: () => finish(true), cancel: () => finish(false) };
}

/**
 * Upload a photo or PDF and get a form filled in. `noun` names the document in
 * messages ("bill", "receipt"); `help` says what gets filled.
 */
export function ScanBox<T>({
  ready,
  noun,
  help,
  waitHelp = "This usually takes under a minute, longer on busy days. Please keep this screen open.",
  say,
  action,
  onScan,
  adds = false,
  keep = false,
}: {
  ready: boolean;
  noun: string;
  help: string;
  waitHelp?: string;
  /** What to say when speaking instead of scanning, e.g. "the customer, then each part and how many". Without it there is no Speak button. */
  say?: string;
  action: (form: FormData) => Promise<Answer<T>>;
  /** `keptId` is the copy kept for Documents (with `keep`), to send with the save. */
  onScan: (scan: T, keptId?: number) => void;
  /** The scan adds to what is typed instead of replacing it. */
  adds?: boolean;
  /** Keep a small copy of the photo or PDF in Documents once the form is saved. */
  keep?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reading, startReading] = useTransition();

  const article = /^[aeiou]/i.test(noun) ? "an" : "a";
  const recordable = useSyncExternalStore(noSubscribe, canRecord, () => false);

  const read = (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    setNote(null);
    startReading(async () => {
      const voiceNote = isVoiceMimeType(picked.type);
      const photo = !voiceNote && picked.type.startsWith("image/");
      // A photo to keep travels with its small copy, so the reading copy leaves room for it.
      const limit = keep && photo ? UPLOAD_MAX_BYTES - KEEP_MAX_BYTES : UPLOAD_MAX_BYTES;
      const file = voiceNote ? picked : await shrinkImage(picked, limit);
      if (!isScanMimeType(file.type)) return setError(`Use a photo (JPG or PNG) or a PDF of the ${noun}.`);
      if (file.size > limit) return setError(`This file is too big. Use a file under 4 MB, or take a photo of the ${noun} instead.`);
      const form = new FormData();
      form.set("file", file);
      if (keep && photo) {
        const small = await shrinkImage(picked, KEEP_MAX_BYTES, KEEP_MAX_SIDE);
        if (small.size <= KEEP_MAX_BYTES) form.set("keep", small);
      } else if (keep && !voiceNote) {
        form.set("keepSame", "1"); // A PDF is kept as it is, without sending it twice.
      }
      try {
        const result = await action(form);
        if (result.error !== undefined) setError(result.error);
        else {
          if (result.keepNote) setNote(result.keepNote);
          onScan(result.scan, result.keptId);
        }
      } catch {
        setError(`Could not read the ${noun}. Check your internet and try again.`);
      }
    });
  };

  const voice = useVoice(
    (file) => read(file),
    (message) => setError(message),
  );
  const listening = voice.seconds != null;
  const speakable = !!say && recordable;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
      <div className="flex flex-wrap items-center gap-3">
        {listening ? (
          <>
            <Button type="button" variant="outline" onClick={voice.stop}>
              <SquareIcon /> Stop and fill
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={voice.cancel}>
              <XIcon /> Cancel
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" disabled={!ready || reading} onClick={() => inputRef.current?.click()}>
              <ScanLineIcon /> {reading ? `Reading the ${noun}…` : `Scan ${article} ${noun}`}
            </Button>
            {speakable && !reading && (
              <Button type="button" variant="outline" disabled={!ready} onClick={() => void voice.start()}>
                <MicIcon /> Speak
              </Button>
            )}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            read(e.target.files?.[0]);
            e.target.value = ""; // Let the same file be chosen again.
          }}
        />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {listening ? (
            <span className="text-foreground" role="status">
              <span className="mr-1.5 inline-block size-2 animate-pulse rounded-full bg-destructive align-middle" aria-hidden />
              Listening {Math.floor(voice.seconds! / 60)}:{String(voice.seconds! % 60).padStart(2, "0")} · say {say}, then press
              Stop.
            </span>
          ) : reading ? (
            waitHelp
          ) : ready ? (
            <>
              {help}
              {speakable && <> Or press Speak and say {say}.</>}
            </>
          ) : (
            "Scanning is not set up yet. Fill in the form by hand below."
          )}{" "}
          {ready && !reading && !listening && (
            <InfoTip label="About scanning">
              The photo{speakable ? " or recording" : ""} is sent to Google&apos;s AI service to be read.{" "}
              {keep
                ? "A small copy of the photo or PDF is kept in Documents, attached to what you save. Recordings are not kept."
                : "It is not kept in this app."}{" "}
              {adds ? "What is read is added to what is already below." : "Scanning replaces anything already typed below."}
            </InfoTip>
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </section>
  );
}

/** What a scan could not settle, for the user to check before saving. */
export function ScanWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div role="status" className="rounded-xl border p-3 text-sm">
      <p className="font-medium">Please check before saving:</p>
      <ul className="mt-1 list-disc pl-5 text-muted-foreground">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

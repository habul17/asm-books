"use client";

import { ScanLineIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { isScanMimeType, SCAN_MAX_BYTES } from "@/lib/bills/scan";
import { shrinkImage } from "@/lib/bills/shrink-image";

/** Room left for the form fields that travel with the file. */
const UPLOAD_MAX_BYTES = SCAN_MAX_BYTES - 100 * 1024;

type Answer<T> = { scan: T; error?: never } | { error: string; scan?: never };

/**
 * Upload a photo or PDF and get a form filled in. `noun` names the document in
 * messages ("bill", "receipt"); `help` says what gets filled.
 */
export function ScanBox<T>({
  ready,
  noun,
  help,
  waitHelp = "This usually takes under a minute, longer on busy days. Please keep this screen open.",
  action,
  onScan,
  adds = false,
}: {
  ready: boolean;
  noun: string;
  help: string;
  waitHelp?: string;
  action: (form: FormData) => Promise<Answer<T>>;
  onScan: (scan: T) => void;
  /** The scan adds to what is typed instead of replacing it. */
  adds?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();

  const article = /^[aeiou]/i.test(noun) ? "an" : "a";

  const read = (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    startReading(async () => {
      const file = await shrinkImage(picked, UPLOAD_MAX_BYTES);
      if (!isScanMimeType(file.type)) return setError(`Use a photo (JPG or PNG) or a PDF of the ${noun}.`);
      if (file.size > UPLOAD_MAX_BYTES) return setError(`This file is too big. Use a file under 4 MB, or take a photo of the ${noun} instead.`);
      const form = new FormData();
      form.set("file", file);
      try {
        const result = await action(form);
        if (result.error !== undefined) setError(result.error);
        else onScan(result.scan);
      } catch {
        setError(`Could not read the ${noun}. Check your internet and try again.`);
      }
    });
  };

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={!ready || reading} onClick={() => inputRef.current?.click()}>
          <ScanLineIcon /> {reading ? `Reading the ${noun}…` : `Scan ${article} ${noun}`}
        </Button>
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
          {reading ? waitHelp : ready ? help : "Scanning is not set up yet. Fill in the form by hand below."}{" "}
          {ready && !reading && (
            <InfoTip label="About scanning">
              The photo is sent to Google&apos;s AI service to be read. It is not kept in this app.{" "}
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

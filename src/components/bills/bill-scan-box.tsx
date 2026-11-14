"use client";

import { ScanLineIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { scanBillAction } from "@/app/(app)/bills/actions";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { isScanMimeType, SCAN_MAX_BYTES } from "@/lib/bills/scan";
import { shrinkImage } from "@/lib/bills/shrink-image";
import type { BillScanResult } from "@/server/bill-scan";

/** Room left for the form fields that travel with the file. */
const UPLOAD_MAX_BYTES = SCAN_MAX_BYTES - 100 * 1024;

/** Upload a photo or PDF of a vendor's bill and get the bill form filled in. */
export function BillScanBox({ ready, onScan }: { ready: boolean; onScan: (scan: BillScanResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();

  const read = (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    startReading(async () => {
      const file = await shrinkImage(picked, UPLOAD_MAX_BYTES);
      if (!isScanMimeType(file.type)) return setError("Use a photo (JPG or PNG) or a PDF of the bill.");
      if (file.size > UPLOAD_MAX_BYTES) return setError("This file is too big. Use a file under 4 MB, or take a photo of the bill instead.");
      const form = new FormData();
      form.set("file", file);
      try {
        const result = await scanBillAction(form);
        if (result.error !== undefined) setError(result.error);
        else onScan(result.scan);
      } catch {
        setError("Could not read the bill. Check your internet and try again.");
      }
    });
  };

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" disabled={!ready || reading} onClick={() => inputRef.current?.click()}>
          <ScanLineIcon /> {reading ? "Reading the bill…" : "Scan a bill"}
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
          {reading
            ? "This can take up to a minute. Please wait."
            : ready
              ? "Take a photo or upload a PDF of the vendor\u2019s bill. The form below is filled in for you to check."
              : "Bill scanning is not set up yet. Enter the bill by hand below."}{" "}
          {ready && !reading && (
            <InfoTip label="About bill scanning">
              The photo is sent to Google&apos;s AI service to be read. It is not kept in this app. Scanning replaces
              anything already typed below.
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

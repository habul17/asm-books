"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import type { BillScanResult } from "@/server/bill-scan";

import { addDays, BillEditor, type BillDraft } from "./bill-editor";
import { BillScanBox } from "./bill-scan-box";

interface Scanned {
  /** Changes with every scan, so the editor starts again from the new draft. */
  version: number;
  draft: BillDraft;
  printedTotal: number | null;
  warnings: string[];
  flagged: number;
}

/** The new-bill page: enter a bill by hand, or scan one and check what was read. */
export function NewBillWorkspace({
  initial,
  sellerState,
  cancelHref,
  scanReady,
}: {
  initial: BillDraft;
  sellerState: string | null;
  cancelHref: string;
  scanReady: boolean;
}) {
  const [scanned, setScanned] = useState<Scanned | null>(null);

  const applyScan = (scan: BillScanResult) =>
    setScanned((previous) => {
      const version = (previous?.version ?? 0) + 1;
      const vendor = scan.vendor ?? initial.vendor;
      return {
        version,
        printedTotal: scan.printedTotal,
        warnings: scan.warnings,
        flagged: scan.lines.filter((l) => l.flags.length > 0).length,
        draft: {
          ...initial,
          vendor,
          billNo: scan.billNo,
          date: scan.date,
          dueDate: vendor?.paymentTermsDays != null ? addDays(scan.date, vendor.paymentTermsDays) : "",
          roundTotal: scan.roundTotal,
          lines: scan.lines.map((l, i) => ({ ...l, key: `s${version}-${i}` })),
        },
      };
    });

  return (
    <div className="flex flex-col gap-5">
      <BillScanBox ready={scanReady} onScan={applyScan} />
      {scanned && (
        <section
          aria-label="Scan result"
          className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="font-medium">
            Read {scanned.draft.lines.length} item{scanned.draft.lines.length === 1 ? "" : "s"} from the bill.
            {scanned.flagged > 0 && ` ${scanned.flagged} need${scanned.flagged === 1 ? "s" : ""} a look.`}
          </p>
          <p>Check every row against the paper bill before you save. A scan can misread a digit.</p>
          {scanned.warnings.length > 0 && (
            <ul className="flex flex-col gap-1">
              {scanned.warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <BillEditor
        key={scanned?.version ?? 0}
        initial={scanned?.draft ?? initial}
        sellerState={sellerState}
        cancelHref={cancelHref}
        printedTotal={scanned?.printedTotal ?? null}
      />
    </div>
  );
}

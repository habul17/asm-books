"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import type { BillScanResult } from "@/server/bill-scan";

import { addDays, BillEditor, type BillDraft } from "./bill-editor";
import { BillScanBox } from "./bill-scan-box";

/** Scan warnings about the paper bill itself, which do not matter for an order. */
const BILL_ONLY = /^(The bill number|The bill date|The bill's total|Bill .* is already entered)/;

interface Scanned {
  /** Changes with every scan, so the editor starts again from the new draft. */
  version: number;
  draft: BillDraft;
  printedTotal: number | null;
  warnings: string[];
  flagged: number;
  /** The copy of the paper kept for Documents, attached when the bill is saved. */
  keptId?: number;
  /** The supplier as printed, when they are not a saved vendor. */
  supplier: { name: string | null; gstin: string | null } | null;
}

/**
 * The new-bill page: enter a bill by hand, or scan one and check what was read.
 * With `kind="order"` it starts a purchase order from a scanned list or quotation.
 */
export function NewBillWorkspace({
  initial,
  sellerState,
  cancelHref,
  scanReady,
  kind = "bill",
}: {
  kind?: "bill" | "order";
  initial: BillDraft;
  sellerState: string | null;
  cancelHref: string;
  scanReady: boolean;
}) {
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const isOrder = kind === "order";

  const applyScan = (scan: BillScanResult, keptId?: number) =>
    setScanned((previous) => {
      const version = (previous?.version ?? 0) + 1;
      const vendor = scan.vendor ?? initial.vendor;
      return {
        version,
        keptId,
        printedTotal: scan.printedTotal,
        warnings: isOrder ? scan.warnings.filter((w) => !BILL_ONLY.test(w)) : scan.warnings,
        flagged: scan.lines.filter((l) => l.flags.length > 0).length,
        supplier: scan.vendor ? null : scan.supplier,
        draft: {
          ...initial,
          vendor,
          // An order gets its own number and today's date; a bill keeps what is printed.
          ...(isOrder
            ? {}
            : {
                billNo: scan.billNo,
                date: scan.date,
                dueDate: vendor?.paymentTermsDays != null ? addDays(scan.date, vendor.paymentTermsDays) : "",
              }),
          roundTotal: scan.roundTotal,
          lines: scan.lines.map((l, i) => ({ ...l, key: `s${version}-${i}` })),
        },
      };
    });

  return (
    <div className="flex flex-col gap-5">
      <BillScanBox ready={scanReady} onScan={applyScan} kind={kind} />
      {scanned && (
        <section
          aria-label="Scan result"
          className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <p className="font-medium">
            Read {scanned.draft.lines.length} item{scanned.draft.lines.length === 1 ? "" : "s"} from the {isOrder ? "list" : "bill"}.
            {scanned.flagged > 0 && ` ${scanned.flagged} need${scanned.flagged === 1 ? "s" : ""} a look.`}
          </p>
          <p>Check every row against the paper {isOrder ? "list" : "bill"} before you save. A scan can misread a digit.</p>
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
        kind={kind}
        key={scanned?.version ?? 0}
        initial={scanned?.draft ?? initial}
        sellerState={sellerState}
        cancelHref={cancelHref}
        printedTotal={scanned?.printedTotal ?? null}
        scannedSupplier={scanned?.supplier ?? null}
        scanDocumentId={scanned?.keptId}
        priceCheckOnOpen={scanned != null && !isOrder}
      />
    </div>
  );
}

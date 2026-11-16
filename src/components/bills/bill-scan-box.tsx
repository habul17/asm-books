"use client";

import { scanBillAction } from "@/app/(app)/bills/actions";
import { ScanBox } from "@/components/forms/scan-box";
import type { BillScanResult } from "@/server/bill-scan";

/**
 * Upload a photo or PDF of a vendor's bill and get the bill form filled in.
 * For a purchase order the same reader takes a parts list or a supplier's quotation.
 */
export function BillScanBox({
  ready,
  onScan,
  kind = "bill",
}: {
  ready: boolean;
  onScan: (scan: BillScanResult, keptId?: number) => void;
  kind?: "bill" | "order";
}) {
  if (kind === "order")
    return (
      <ScanBox
        ready={ready}
        noun="list"
        say="the supplier, and each part with how many to order"
        help="Take a photo of a handwritten parts list or the supplier’s quotation. The order below is filled in for you to check."
        waitHelp="This can take 1 to 3 minutes for a long list. Please keep this screen open."
        action={scanBillAction}
        onScan={onScan}
      />
    );
  return (
    <ScanBox
      keep
      ready={ready}
      noun="bill"
      say="the supplier, bill number, and each part with how many and the rate"
      help={"Take a photo or upload a PDF of the vendor’s bill. The form below is filled in for you to check."}
      waitHelp="This can take 1 to 3 minutes for a long bill. Please keep this screen open."
      action={scanBillAction}
      onScan={onScan}
    />
  );
}

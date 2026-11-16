"use client";

import { scanBillAction } from "@/app/(app)/bills/actions";
import { ScanBox } from "@/components/forms/scan-box";
import type { BillScanResult } from "@/server/bill-scan";

/** Upload a photo or PDF of a vendor's bill and get the bill form filled in. */
export function BillScanBox({ ready, onScan }: { ready: boolean; onScan: (scan: BillScanResult) => void }) {
  return (
    <ScanBox
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

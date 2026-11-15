import type { Metadata } from "next";

import { StatementCheck } from "@/components/banking/statement-check";
import { OwnerGate } from "@/components/layout/owner-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { billScanReady } from "@/server/bill-scan";

export const metadata: Metadata = { title: "Check bank statement" };

// Reading a month of bank entries can take a few minutes.
export const maxDuration = 300;

export default function BankStatementPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Check bank statement</h1>
      <OwnerGate what="check the bank statement" fallback={<Skeleton className="h-24 rounded-xl" />}>
        <StatementCheck scanReady={billScanReady()} />
      </OwnerGate>
    </div>
  );
}

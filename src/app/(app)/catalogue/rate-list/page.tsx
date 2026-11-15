import type { Metadata } from "next";
import { connection } from "next/server";

import { RateListReview } from "@/components/catalogue/rate-list-review";
import { OwnerGate } from "@/components/layout/owner-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { billScanReady } from "@/server/bill-scan";
import { todayInIndia } from "@/server/invoice-writes";

export const metadata: Metadata = { title: "Read a rate list" };

// Reading a long rate list can take a few minutes.
export const maxDuration = 300;

async function Review() {
  await connection(); // Today's date must be read per request.
  return <RateListReview scanReady={billScanReady()} today={todayInIndia()} />;
}

export default function RateListPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Read a supplier rate list</h1>
      <OwnerGate what="update purchase prices" fallback={<Skeleton className="h-24 rounded-xl" />}>
        <Review />
      </OwnerGate>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { StockCheck } from "@/components/adjustments/stock-check";
import { Skeleton } from "@/components/ui/skeleton";
import { stockList } from "@/server/adjustments";

export const metadata: Metadata = { title: "Stock check" };

async function Body() {
  return <StockCheck parts={await stockList()} />;
}

export default function StockCheckPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Stock check</h1>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Body />
      </Suspense>
    </div>
  );
}

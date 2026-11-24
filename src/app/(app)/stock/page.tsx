import type { Metadata } from "next";
import { Suspense } from "react";

import { StockList } from "@/components/stock/stock-list";
import { Skeleton } from "@/components/ui/skeleton";
import { stockOverview } from "@/server/stock";

export const metadata: Metadata = { title: "Stock" };

async function Body() {
  const { owner, items } = await stockOverview();
  return <StockList items={items} owner={owner} />;
}

export default function StockPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold max-md:sr-only">Stock</h1>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <Body />
      </Suspense>
    </div>
  );
}

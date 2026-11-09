import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyReport, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { Badge } from "@/components/ui/badge";
import { formatQty } from "@/lib/format";
import { LOW_STOCK_LIMIT, lowStock } from "@/server/reports";

export const metadata: Metadata = { title: "Low Stock" };

async function Body() {
  const { items, more } = await lowStock();
  if (items.length === 0) return <EmptyReport>Nothing to reorder right now.</EmptyReport>;
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {more ? `First ${LOW_STOCK_LIMIT} parts` : `${items.length} part${items.length === 1 ? "" : "s"}`} to reorder
      </p>
      <ul className="flex flex-col divide-y rounded-xl border">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={`/catalogue?id=${p.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 hover:bg-muted/60"
            >
              <span className="truncate font-medium">{p.description}</span>
              <span className={`text-right font-medium tabular-nums ${p.stockQty < 0 ? "text-destructive" : ""}`}>
                {formatQty(p.stockQty)} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span>
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">{p.partNo}</span>
              <span className="flex justify-end">
                {p.stockQty < 0 ? (
                  <Badge variant="destructive">below 0</Badge>
                ) : p.stockQty === 0 ? (
                  <Badge variant="destructive">out of stock</Badge>
                ) : (
                  <Badge variant="secondary">min {formatQty(p.minStock)}</Badge>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function LowStockPage() {
  return (
    <ReportPage>
      <ReportHeader title="Low Stock">
        Parts out of stock (that you have stocked or sold before) or at their minimum level. Set a part&rsquo;s minimum on its Items page.
      </ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body />
      </Suspense>
    </ReportPage>
  );
}

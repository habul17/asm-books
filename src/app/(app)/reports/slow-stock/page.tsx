import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyReport, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { SLOW_STOCK_DAYS, SLOW_STOCK_LIMIT, slowStock } from "@/server/reports";

export const metadata: Metadata = { title: "Slow Stock" };

async function Body() {
  const { items, more } = await slowStock();
  if (items.length === 0) return <EmptyReport>Every part in stock has sold in the last {SLOW_STOCK_DAYS} days.</EmptyReport>;
  const value = items.reduce((s, p) => s + p.value, 0);
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {more ? `First ${SLOW_STOCK_LIMIT} parts` : `${items.length} part${items.length === 1 ? "" : "s"}`} ·{" "}
        {formatMoney(value)} at purchase price
      </p>
      <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={`/catalogue?id=${p.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 hover:bg-muted/60"
            >
              <span className="truncate font-medium">{p.description}</span>
              <span className="text-right font-medium tabular-nums">{formatMoney(p.value)}</span>
              <span className="truncate text-xs text-muted-foreground">
                <span className="font-mono">{p.partNo}</span> · {p.lastSold ? `Last sold ${formatDate(p.lastSold)}` : "Never sold"}
              </span>
              <span className="text-right text-xs text-muted-foreground tabular-nums">
                {formatQty(p.stockQty)} {p.unit}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function SlowStockPage() {
  return (
    <ReportPage>
      <ReportHeader title="Slow Stock">
        Parts on the shelf that have not sold in the last {SLOW_STOCK_DAYS} days, the most money first. Parts bought in
        the last {SLOW_STOCK_DAYS} days are left out. Values are what the stock actually cost: each purchase bill&rsquo;s pieces at that bill&rsquo;s price.
      </ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body />
      </Suspense>
    </ReportPage>
  );
}

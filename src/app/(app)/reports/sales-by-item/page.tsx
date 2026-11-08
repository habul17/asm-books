import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PeriodCaption } from "@/components/reports/period-caption";
import { EmptyReport, PeriodPicker, periodParams, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { formatMoney, formatQty } from "@/lib/format";
import { ITEM_REPORT_LIMIT, readPeriod, salesByItem } from "@/server/reports";

export const metadata: Metadata = { title: "Sales by Item" };

const PATH = "/reports/sales-by-item";

async function Body({ searchParams }: { searchParams: PageProps<"/reports/sales-by-item">["searchParams"] }) {
  const period = await readPeriod(periodParams(await searchParams));
  const { count, items, totals } = await salesByItem(period);
  const profit = totals.taxable - totals.cost - totals.noCost;
  return (
    <>
      <PeriodPicker path={PATH} period={period} />
      <PeriodCaption period={period} />
      {items.length === 0 ? (
        <EmptyReport>No sales in this period.</EmptyReport>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {count > items.length ? `Top ${ITEM_REPORT_LIMIT} of ${count} items` : `${count} item${count === 1 ? "" : "s"}`} · sold{" "}
            {formatMoney(totals.taxable)} · profit {formatMoney(profit)}
          </p>
          {totals.noCost > 0 && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              {formatMoney(totals.noCost)} of sales had no purchase price, so their profit is not counted. Add purchase
              prices to those parts for a true profit.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-2 py-2 text-right font-medium">Qty</th>
                  <th className="px-2 py-2 text-right font-medium">Sold</th>
                  <th className="px-4 py-2 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {items.map((r) => (
                  <tr key={r.productId ?? `d:${r.description}`}>
                    <td className="max-w-56 px-4 py-2">
                      {r.productId == null ? (
                        <span className="font-medium">{r.description}</span>
                      ) : (
                        <Link href={`/catalogue?id=${r.productId}`} className="font-medium hover:underline">
                          {r.description}
                        </Link>
                      )}
                      {r.partNo && <span className="block font-mono text-xs text-muted-foreground">{r.partNo}</span>}
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {formatQty(r.qty)} <span className="text-xs text-muted-foreground">{r.unit}</span>
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">{formatMoney(r.taxable)}</td>
                    <td className="px-4 py-2 text-right">
                      {r.noCost > 0 && r.cost === 0 ? (
                        <span className="text-xs text-muted-foreground">no cost</span>
                      ) : (
                        <span className={r.profit < 0 ? "text-destructive" : undefined}>{formatMoney(r.profit)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

export default function SalesByItemPage({ searchParams }: PageProps<"/reports/sales-by-item">) {
  return (
    <ReportPage>
      <ReportHeader title="Sales by Item">
        Amounts before GST, less returns. Profit uses the purchase price when each part was sold.
      </ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </ReportPage>
  );
}

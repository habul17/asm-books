import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PeriodCaption } from "@/components/reports/period-caption";
import { EmptyReport, PeriodPicker, periodParams, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { formatMoney } from "@/lib/format";
import { readPeriod, salesByCustomer } from "@/server/reports";

export const metadata: Metadata = { title: "Sales by Customer" };

const PATH = "/reports/sales-by-customer";

async function Body({ searchParams }: { searchParams: PageProps<"/reports/sales-by-customer">["searchParams"] }) {
  const period = await readPeriod(periodParams(await searchParams));
  const { items, totals } = await salesByCustomer(period);
  return (
    <>
      <PeriodPicker path={PATH} period={period} />
      <PeriodCaption period={period} />
      {items.length === 0 ? (
        <EmptyReport>No sales in this period.</EmptyReport>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-2 py-2 text-right font-medium">Sales</th>
                <th className="px-2 py-2 text-right font-medium">Returns</th>
                <th className="px-4 py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {items.map((r) => (
                <tr key={r.customerId ?? "walk-in"}>
                  <td className="max-w-48 px-4 py-2">
                    {r.customerId == null ? (
                      <span className="text-muted-foreground">{r.name}</span>
                    ) : (
                      <Link href={`/customers?id=${r.customerId}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {r.count} invoice{r.count === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{formatMoney(r.sales)}</td>
                  <td className="px-2 py-2 text-right text-muted-foreground">{r.returns ? formatMoney(r.returns) : "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatMoney(r.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/50 font-semibold tabular-nums">
              <tr>
                <td className="px-4 py-2">Total</td>
                <td className="px-2 py-2 text-right whitespace-nowrap">{formatMoney(totals.sales)}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap">{formatMoney(totals.returns)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">{formatMoney(totals.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

export default function SalesByCustomerPage({ searchParams }: PageProps<"/reports/sales-by-customer">) {
  return (
    <ReportPage>
      <ReportHeader title="Sales by Customer">Invoice totals with GST, less returns. Biggest buyers first.</ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </ReportPage>
  );
}

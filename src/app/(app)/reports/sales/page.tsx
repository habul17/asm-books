import type { Metadata } from "next";
import { Suspense } from "react";

import { PeriodCaption } from "@/components/reports/period-caption";
import { EmptyReport, Figures, PeriodPicker, periodParams, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_MODE_LABELS } from "@/lib/payments/validation";
import { readPeriod, salesSummary } from "@/server/reports";

export const metadata: Metadata = { title: "Sales Summary" };

const PATH = "/reports/sales";

async function Body({ searchParams }: { searchParams: PageProps<"/reports/sales">["searchParams"] }) {
  const period = await readPeriod(periodParams(await searchParams));
  const { sales, returns, net, received, days } = await salesSummary(period);
  const receivedTotal = received.reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <PeriodPicker path={PATH} period={period} />
      <PeriodCaption period={period} />
      <Figures
        rows={[
          {
            label: `Sales · ${sales.count} invoice${sales.count === 1 ? "" : "s"}`,
            hint: `Cash ${formatMoney(sales.cash)} · on credit ${formatMoney(sales.credit)}`,
            value: sales.total,
          },
          { label: `Returns · ${returns.count} credit note${returns.count === 1 ? "" : "s"}`, value: returns.total, minus: true },
          { label: "Net sales", hint: `Before GST ${formatMoney(net.taxable)}`, value: net.total, strong: true },
        ]}
      />
      <Figures
        title="Money received"
        rows={[
          ...received.map((r) => ({
            label: `${PAYMENT_MODE_LABELS[r.mode]} · ${r.count} receipt${r.count === 1 ? "" : "s"}`,
            value: r.amount,
          })),
          { label: "Total received", hint: "Payments from customers, not counting cash sales", value: receivedTotal, strong: true },
        ]}
      />
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-muted-foreground">Day by day</h2>
        {days.length === 0 ? (
          <EmptyReport>No sales in this period.</EmptyReport>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 text-right font-medium">Invoices</th>
                  <th className="px-2 py-2 text-right font-medium">Sales</th>
                  <th className="px-4 py-2 text-right font-medium">Returns</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {days.map((d) => (
                  <tr key={d.date}>
                    <td className="px-4 py-2">{formatDate(d.date)}</td>
                    <td className="px-2 py-2 text-right">{d.count}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">{formatMoney(d.sales)}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{d.returns ? formatMoney(d.returns) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function SalesReportPage({ searchParams }: PageProps<"/reports/sales">) {
  return (
    <ReportPage>
      <ReportHeader title="Sales Summary">Sales, returns and money received, with GST.</ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </ReportPage>
  );
}

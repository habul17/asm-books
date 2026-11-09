import type { Metadata } from "next";
import { Suspense } from "react";

import { PeriodCaption } from "@/components/reports/period-caption";
import { EmptyReport, PeriodPicker, periodParams, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { formatMoney } from "@/lib/format";
import { expensesByCategory, readPeriod } from "@/server/reports";

export const metadata: Metadata = { title: "Expenses by Category" };

const PATH = "/reports/expenses-by-category";

async function Body({ searchParams }: { searchParams: PageProps<"/reports/expenses-by-category">["searchParams"] }) {
  const period = await readPeriod(periodParams(await searchParams));
  const { items, total, gst } = await expensesByCategory(period);
  return (
    <>
      <PeriodPicker path={PATH} period={period} />
      <PeriodCaption period={period} />
      {items.length === 0 ? (
        <EmptyReport>No expenses in this period.</EmptyReport>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((e) => {
            const pct = total > 0 ? (e.amount / total) * 100 : 0;
            return (
              <li key={e.category} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{e.category}</span>
                  <span className="font-medium tabular-nums">{formatMoney(e.amount)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {e.count} expense{e.count === 1 ? "" : "s"} · {Math.round(pct)}%
                </span>
              </li>
            );
          })}
          <li className="flex items-baseline justify-between gap-3 bg-muted/50 px-4 py-3 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(total)}</span>
          </li>
        </ul>
      )}
      {items.length > 0 && gst > 0 && (
        <p className="text-xs text-muted-foreground">
          Amounts are before GST. GST you can claim back on these expenses: {formatMoney(gst)} (shown in the GST
          Summary).
        </p>
      )}
    </>
  );
}

export default function ExpensesByCategoryPage({ searchParams }: PageProps<"/reports/expenses-by-category">) {
  return (
    <ReportPage>
      <ReportHeader title="Expenses by Category">Where your money went, biggest first.</ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </ReportPage>
  );
}

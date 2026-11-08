import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PeriodCaption } from "@/components/reports/period-caption";
import { Figures, PeriodPicker, periodParams, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { formatMoney } from "@/lib/format";
import { periodQuery } from "@/lib/reports/period";
import { profitAndLoss, readPeriod } from "@/server/reports";

export const metadata: Metadata = { title: "Profit and Loss" };

const PATH = "/reports/profit-and-loss";

async function Body({ searchParams }: { searchParams: PageProps<"/reports/profit-and-loss">["searchParams"] }) {
  const period = await readPeriod(periodParams(await searchParams));
  const pl = await profitAndLoss(period);
  const q = periodQuery(period);
  const withPeriod = (path: string) => (q ? `${path}?${q}` : path);
  return (
    <>
      <PeriodPicker path={PATH} period={period} />
      <PeriodCaption period={period} />
      <Figures
        title="Trading"
        rows={[
          {
            label: (
              <Link href={withPeriod("/reports/sales-by-item")} className="hover:underline">
                Sales (less returns)
              </Link>
            ),
            hint: "Before GST",
            value: pl.sales,
          },
          { label: "Cost of parts sold", hint: "Purchase price when sold", value: pl.costOfSales, minus: true },
          { label: "Gross profit", value: pl.gross, strong: true },
        ]}
      />
      <Figures
        title="Expenses"
        rows={[
          ...pl.expenses.map((e) => ({ label: e.category, value: e.amount, minus: true })),
          ...(pl.stockLost ? [{ label: "Stock lost or damaged", hint: "Inventory adjustments", value: pl.stockLost, minus: true }] : []),
          ...(pl.stockFound ? [{ label: "Stock found (count corrections)", hint: "Adds to profit", value: pl.stockFound }] : []),
          {
            label: (
              <Link href={withPeriod("/reports/expenses-by-category")} className="hover:underline">
                Total expenses
              </Link>
            ),
            value: pl.expensesTotal + pl.stockLost - pl.stockFound,
            minus: true,
            strong: true,
          },
        ]}
      />
      <Figures rows={[{ label: "Net profit", hint: pl.net < 0 ? "A loss for this period" : undefined, value: pl.net, strong: true }]} />
      {(pl.salesWithoutCost > 0 || pl.adjustmentLinesWithoutCost > 0) && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {pl.salesWithoutCost > 0 && (
            <>
              {formatMoney(pl.salesWithoutCost)} of sales were parts with no purchase price, so their cost counts as ₹0 and
              the profit shows higher than it really is.{" "}
            </>
          )}
          {pl.adjustmentLinesWithoutCost > 0 && (
            <>
              {pl.adjustmentLinesWithoutCost} adjusted part{pl.adjustmentLinesWithoutCost === 1 ? " has" : "s have"} no
              purchase price and {pl.adjustmentLinesWithoutCost === 1 ? "is" : "are"} counted as ₹0.
            </>
          )}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        GST is left out: it is collected for the government, not your income. Opening stock is not counted as profit.
      </p>
    </>
  );
}

export default function ProfitAndLossPage({ searchParams }: PageProps<"/reports/profit-and-loss">) {
  return (
    <ReportPage>
      <ReportHeader title="Profit and Loss">What you earned after the cost of parts and your expenses.</ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </ReportPage>
  );
}

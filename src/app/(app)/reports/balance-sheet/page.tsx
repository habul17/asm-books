import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Figures, ReportHeader, ReportPage, ReportSkeleton, type FigureRow } from "@/components/reports/report-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { asOfPresets } from "@/lib/reports/statements";
import { balanceSheet, readAsOf } from "@/server/statements";

export const metadata: Metadata = { title: "Balance Sheet" };

const PATH = "/reports/balance-sheet";

/** Quick dates plus a date box. Works without JavaScript (a plain GET form). */
function DatePicker({ asOf, today }: { asOf: string; today: string }) {
  return (
    <div className="flex flex-col gap-3 print:hidden">
      <nav aria-label="Date" className="flex flex-wrap gap-2">
        {asOfPresets(today).map((p) => (
          <Link
            key={p.label}
            href={p.date === today ? PATH : `${PATH}?date=${p.date}`}
            aria-current={p.date === asOf ? "page" : undefined}
            className={buttonVariants({ variant: p.date === asOf ? "default" : "outline", size: "sm" })}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <form action={PATH} method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          As on
          <Input type="date" name="date" required max={today} defaultValue={asOf} className="h-9 w-40" />
        </label>
        <Button type="submit" variant="secondary" size="sm" className="h-9">
          Show
        </Button>
      </form>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/reports/balance-sheet">["searchParams"] }) {
  const raw = (await searchParams).date;
  const { asOf, today } = await readAsOf(Array.isArray(raw) ? raw[0] : raw);
  const b = await balanceSheet(asOf);
  const isToday = asOf === today;
  /** Balances reports show today's figures, so they are linked only for today. */
  const linked = (label: string, href: string) =>
    isToday ? (
      <Link href={href} className="hover:underline">
        {label}
      </Link>
    ) : (
      label
    );

  const assets: FigureRow[] = [
    { label: "Cash and bank", hint: "Opening balance plus money in, less money out", value: b.assets.cash },
    { label: linked("Customers owe you", "/reports/customer-balances"), value: b.assets.receivables },
    ...(b.assets.vendorAdvances ? [{ label: "Paid in advance to vendors", value: b.assets.vendorAdvances }] : []),
    { label: "Stock in hand", hint: "At purchase price, before GST", value: b.assets.stock },
    ...(b.assets.gstCredit
      ? [{ label: "GST credit", hint: "GST paid on purchases beyond GST charged on sales", value: b.assets.gstCredit }]
      : []),
    { label: "Total assets", value: b.totalAssets, strong: true },
  ];
  const liabilities: FigureRow[] = [
    { label: linked("You owe vendors", "/reports/vendor-balances"), value: b.liabilities.payables },
    ...(b.liabilities.customerAdvances
      ? [{ label: "Advances from customers", value: b.liabilities.customerAdvances }]
      : []),
    ...(b.liabilities.gstPayable
      ? [{ label: "GST to pay", hint: "GST charged on sales beyond GST paid on purchases", value: b.liabilities.gstPayable }]
      : []),
    { label: "Total liabilities", value: b.totalLiabilities, strong: true },
  ];
  const capital: FigureRow[] = [
    {
      label: "Profit this financial year",
      hint: `${formatDate(b.fyFrom)} to ${formatDate(asOf)}`,
      value: b.capital.profitThisYear,
    },
    { label: "Capital and earlier profit", hint: "The balancing figure", value: b.capital.earlier },
    { label: "Owner's capital", value: b.capital.total, strong: true },
  ];

  return (
    <>
      <DatePicker asOf={asOf} today={today} />
      <p className="text-sm font-medium" aria-live="polite">
        As on {formatDate(asOf)}
      </p>
      <Figures title="What the business has (assets)" rows={assets} />
      <Figures title="What the business owes (liabilities)" rows={liabilities} />
      <Figures title="What is left for the owner (capital)" rows={capital} />
      <Figures
        rows={[
          {
            label: "Liabilities and capital",
            hint: "Always equal to total assets",
            value: b.totalLiabilities + b.capital.total,
            strong: true,
          },
        ]}
      />
      {(b.openingCash === 0 || b.stockWithoutPrice > 0 || b.stockBelowZero > 0) && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm dark:text-amber-100">
          {b.openingCash === 0 && (
            <>
              The opening cash and bank balance is ₹0. If the shop had money on the day it started using ASM Books, add
              it in{" "}
              <Link href="/settings" className="underline">
                Settings
              </Link>{" "}
              so the cash figure is right.{" "}
            </>
          )}
          {b.stockWithoutPrice > 0 && (
            <>
              {b.stockWithoutPrice} part{b.stockWithoutPrice === 1 ? "" : "s"} in stock {b.stockWithoutPrice === 1 ? "has" : "have"} no
              purchase price and {b.stockWithoutPrice === 1 ? "is" : "are"} counted as ₹0.{" "}
            </>
          )}
          {b.stockBelowZero > 0 && (
            <>
              {b.stockBelowZero} part{b.stockBelowZero === 1 ? "" : "s"} with stock below zero {b.stockBelowZero === 1 ? "is" : "are"}{" "}
              counted as ₹0.
            </>
          )}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Built from what is entered in ASM Books. Money the owner puts in or takes out, loans, equipment and GST paid to
        the government are not entered here, so they are not shown; until they are, cash and GST to pay both show
        higher than in the bank and on the GST portal. Ask your accountant before using this for tax or a loan.
      </p>
    </>
  );
}

export default function BalanceSheetPage({ searchParams }: PageProps<"/reports/balance-sheet">) {
  return (
    <ReportPage>
      <ReportHeader title="Balance Sheet">What the business has and what it owes on a date.</ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </ReportPage>
  );
}

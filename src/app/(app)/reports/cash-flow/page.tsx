import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PeriodCaption } from "@/components/reports/period-caption";
import { Figures, PeriodPicker, periodParams, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { formatDate } from "@/lib/format";
import { periodQuery } from "@/lib/reports/period";
import { readPeriod } from "@/server/reports";
import { cashFlow } from "@/server/statements";

export const metadata: Metadata = { title: "Cash Flow Statement" };

const PATH = "/reports/cash-flow";

async function Body({ searchParams }: { searchParams: PageProps<"/reports/cash-flow">["searchParams"] }) {
  const period = await readPeriod(periodParams(await searchParams));
  const cf = await cashFlow(period);
  const q = periodQuery(period);
  const withPeriod = (path: string) => (q ? `${path}?${q}` : path);
  return (
    <>
      <PeriodPicker path={PATH} period={period} />
      <PeriodCaption period={period} />
      <Figures
        title="Money in"
        rows={[
          { label: "Cash sales", hint: "Invoices paid on the spot", value: cf.cashSales },
          { label: "Received from customers", hint: "Payments against credit sales", value: cf.received },
          ...(cf.otherIncome ? [{ label: "Other income", hint: "Interest, scrap, commission", value: cf.otherIncome }] : []),
          ...(cf.ownerIn ? [{ label: "Owner put money in", value: cf.ownerIn }] : []),
          ...(cf.loansTaken ? [{ label: "Loans received", value: cf.loansTaken }] : []),
          {
            label: (
              <Link href={withPeriod("/reports/sales")} className="hover:underline">
                Total money in
              </Link>
            ),
            value: cf.in,
            strong: true,
          },
        ]}
      />
      <Figures
        title="Money out"
        rows={[
          { label: "Paid to vendors", value: cf.paidToVendors, minus: true },
          { label: "Expenses", hint: "Including GST", value: cf.expenses, minus: true },
          ...(cf.refunds ? [{ label: "Refunds to customers", hint: "Cash given back for returns", value: cf.refunds, minus: true }] : []),
          ...(cf.gstPaid ? [{ label: "GST paid to government", value: cf.gstPaid, minus: true }] : []),
          ...(cf.equipment ? [{ label: "Equipment bought", value: cf.equipment, minus: true }] : []),
          ...(cf.loansRepaid ? [{ label: "Loans repaid", value: cf.loansRepaid, minus: true }] : []),
          ...(cf.ownerOut ? [{ label: "Owner took money out", value: cf.ownerOut, minus: true }] : []),
          { label: "Total money out", value: cf.out, minus: true, strong: true },
        ]}
      />
      <Figures
        title="Cash and bank"
        rows={[
          { label: "Net cash flow", hint: cf.net < 0 ? "More went out than came in" : "Money in less money out", value: cf.net },
          { label: `Balance at start (${formatDate(period.from)})`, value: cf.opening },
          { label: `Balance at end (${formatDate(period.to)})`, value: cf.closing, strong: true },
          { label: "Of which cash in hand", value: cf.closingCash },
          { label: "Of which in the bank", value: cf.closingBank },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Shows money as entered in ASM Books. Enter the owner&apos;s own money, loans, equipment and GST paid to the
        government in{" "}
        <Link href="/banking" className="underline">
          Banking
        </Link>{" "}
        so the balance matches what is really in hand and in the bank. The balance counts from the opening cash and bank
        balances in{" "}
        <Link href="/business" className="underline">
          Settings
        </Link>
        .
      </p>
    </>
  );
}

export default function CashFlowPage({ searchParams }: PageProps<"/reports/cash-flow">) {
  return (
    <ReportPage>
      <ReportHeader title="Cash Flow Statement">Money that came in and went out in a period.</ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </ReportPage>
  );
}

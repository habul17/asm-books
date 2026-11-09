import type { Metadata } from "next";
import { Suspense } from "react";

import { PeriodCaption } from "@/components/reports/period-caption";
import { EmptyReport, PeriodPicker, periodParams, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { formatMoney } from "@/lib/format";
import { gstSummary, readPeriod } from "@/server/reports";

export const metadata: Metadata = { title: "GST Summary" };

const PATH = "/reports/gst";

interface TaxRow {
  label: string;
  hint?: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  strong?: boolean;
}

function TaxTable({ rows }: { rows: TaxRow[] }) {
  // Most shops sell within their state; hide IGST when it is all zero so the table fits a phone.
  const igst = rows.some((r) => r.igst !== 0);
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium" />
            <th className="px-2 py-2 text-right font-medium">Taxable</th>
            <th className="px-2 py-2 text-right font-medium">CGST</th>
            <th className="px-2 py-2 text-right font-medium">SGST</th>
            {igst && <th className="px-2 py-2 text-right font-medium">IGST</th>}
          </tr>
        </thead>
        <tbody className="divide-y tabular-nums">
          {rows.map((r) => (
            <tr key={r.label} className={r.strong ? "bg-muted/50 font-semibold" : undefined}>
              <td className="px-3 py-2 whitespace-nowrap">
                {r.label}
                {r.hint && <span className="block text-xs font-normal text-muted-foreground">{r.hint}</span>}
              </td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{formatMoney(r.taxable)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{formatMoney(r.cgst)}</td>
              <td className="px-2 py-2 text-right whitespace-nowrap">{formatMoney(r.sgst)}</td>
              {igst && <td className="px-2 py-2 text-right whitespace-nowrap">{formatMoney(r.igst)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/reports/gst">["searchParams"] }) {
  const period = await readPeriod(periodParams(await searchParams));
  const g = await gstSummary(period);
  const payable = g.payable.cgst + g.payable.sgst + g.payable.igst;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return (
    <>
      <PeriodPicker path={PATH} period={period} />
      <PeriodCaption period={period} />
      <TaxTable
        rows={[
          { label: "Sales", hint: plural(g.sales.count, "invoice"), ...g.sales },
          { label: "Less returns", hint: plural(g.returns.count, "credit note"), ...g.returns },
          { label: "Output GST", ...g.output, strong: true },
          { label: "Input GST", hint: `Purchase bills · ${g.inputFromBills.count}`, ...g.inputFromBills },
          ...(g.inputFromExpenses.count > 0
            ? [{ label: "Input GST", hint: plural(g.inputFromExpenses.count, "expense"), ...g.inputFromExpenses }]
            : []),
          { label: "Output − input", ...g.payable, strong: true },
        ]}
      />
      <p className="rounded-xl border px-4 py-3 text-sm">
        {payable >= 0 ? "GST to pay (before other credits): " : "Extra input credit: "}
        <span className="font-semibold tabular-nums">{formatMoney(Math.abs(payable))}</span>
        <span className="block text-xs text-muted-foreground">
          A guide only. Check with your accountant before filing.
        </span>
      </p>
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-muted-foreground">Sales by GST rate (less returns)</h2>
        {g.byRate.length === 0 ? (
          <EmptyReport>No sales in this period.</EmptyReport>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Rate</th>
                  <th className="px-2 py-2 text-right font-medium">Taxable</th>
                  <th className="px-4 py-2 text-right font-medium">GST</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {g.byRate.map((r) => (
                  <tr key={r.rate}>
                    <td className="px-4 py-2">{r.rate}%</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">{formatMoney(r.taxable)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{formatMoney(r.tax)}</td>
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

export default function GstReportPage({ searchParams }: PageProps<"/reports/gst">) {
  return (
    <ReportPage>
      <ReportHeader title="GST Summary">GST on your sales against GST on your purchase bills.</ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body searchParams={searchParams} />
      </Suspense>
    </ReportPage>
  );
}

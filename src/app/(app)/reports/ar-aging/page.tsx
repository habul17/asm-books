import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyReport, Figures, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { customersHref } from "@/lib/customers/href";
import { formatDate, formatMoney } from "@/lib/format";
import { AGING_BUCKETS } from "@/lib/reports/aging";
import { arAging } from "@/server/receivables";

export const metadata: Metadata = { title: "AR Aging Summary" };

async function Body() {
  const { today, rows, totals, total } = await arAging();
  if (rows.length === 0) return <EmptyReport>Nobody owes you anything right now.</EmptyReport>;
  return (
    <>
      <p className="text-sm font-medium">As on {formatDate(today)}</p>
      <Figures
        title="All customers"
        rows={[
          ...AGING_BUCKETS.map((b, i) => ({ label: b.label, value: totals[i] })),
          { label: "Customers owe you", value: total, strong: true },
        ]}
      />
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-muted-foreground">
          By customer ({rows.length})
        </h2>
        <ul className="flex flex-col divide-y rounded-xl border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={customersHref({ id: r.id })} className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/60">
                <span className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="text-right font-semibold tabular-nums">{formatMoney(r.total)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[r.mobile, r.city].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="text-right text-xs text-muted-foreground">
                    oldest {r.oldestDays} day{r.oldestDays === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                  {AGING_BUCKETS.map((b, i) => (
                    <span key={b.label} className="flex justify-between gap-2 sm:flex-col sm:gap-0">
                      <span className="text-muted-foreground">{b.label}</span>
                      <span
                        className={`tabular-nums ${
                          r.buckets[i] === 0
                            ? "text-muted-foreground"
                            : i === AGING_BUCKETS.length - 1
                              ? "font-medium text-destructive"
                              : "font-medium"
                        }`}
                      >
                        {r.buckets[i] === 0 ? "—" : formatMoney(r.buckets[i])}
                      </span>
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-muted-foreground">
        Age is counted from the bill date. Payments are counted against the oldest bills first, so what is left unpaid
        is the newest bills. An opening balance is aged from the day the customer was added.
      </p>
    </>
  );
}

export default function ArAgingPage() {
  return (
    <ReportPage>
      <ReportHeader title="AR Aging Summary">What customers owe you, by how old the unpaid bills are.</ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body />
      </Suspense>
    </ReportPage>
  );
}

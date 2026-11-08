import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyReport, Figures, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { customerBalances } from "@/server/reports";

export const metadata: Metadata = { title: "Customer Balances" };

async function Body() {
  const { items, owed, advance } = await customerBalances();
  return (
    <>
      <Figures
        rows={[
          { label: "Customers owe you", value: owed, strong: true },
          ...(advance ? [{ label: "Paid to you in advance", value: advance }] : []),
        ]}
      />
      {items.length === 0 ? (
        <EmptyReport>Nobody owes you anything right now.</EmptyReport>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((c) => {
            const over = c.creditLimit != null && c.balance > c.creditLimit;
            return (
              <li key={c.id}>
                <Link
                  href={`/customers?id=${c.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 hover:bg-muted/60"
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <span className={`text-right font-medium tabular-nums ${c.balance < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    {formatMoney(Math.abs(c.balance))}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[c.mobile, c.city].filter(Boolean).join(" · ") || "—"}
                    {c.creditLimit != null && <> · limit {formatMoney(c.creditLimit)}</>}
                  </span>
                  <span className="flex justify-end">
                    {c.balance < 0 ? (
                      <Badge variant="secondary">advance</Badge>
                    ) : over ? (
                      <Badge variant="destructive">over limit</Badge>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function CustomerBalancesPage() {
  return (
    <ReportPage>
      <ReportHeader title="Customer Balances">Who owes you money right now, biggest first.</ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body />
      </Suspense>
    </ReportPage>
  );
}

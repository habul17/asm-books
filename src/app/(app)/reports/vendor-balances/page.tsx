import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyReport, Figures, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { vendorBalances } from "@/server/reports";

export const metadata: Metadata = { title: "Vendor Balances" };

async function Body() {
  const { items, owed, advance } = await vendorBalances();
  return (
    <>
      <Figures
        rows={[
          { label: "You owe vendors", value: owed, strong: true },
          ...(advance ? [{ label: "You paid in advance", value: advance }] : []),
        ]}
      />
      {items.length === 0 ? (
        <EmptyReport>You do not owe any vendor right now.</EmptyReport>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((v) => (
            <li key={v.id}>
              <Link
                href={`/vendors/${v.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 hover:bg-muted/60"
              >
                <span className="truncate font-medium">{v.name}</span>
                <span className={`text-right font-medium tabular-nums ${v.balance < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                  {formatMoney(Math.abs(v.balance))}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[v.mobile, v.city].filter(Boolean).join(" · ") || "—"}
                  {" · "}
                  {v.lastPaid ? `last paid ${formatDate(v.lastPaid)}` : "never paid"}
                </span>
                <span className="flex justify-end">{v.balance < 0 && <Badge variant="secondary">advance</Badge>}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function VendorBalancesPage() {
  return (
    <ReportPage>
      <ReportHeader title="Vendor Balances">What you owe each supplier right now, biggest first.</ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body />
      </Suspense>
    </ReportPage>
  );
}

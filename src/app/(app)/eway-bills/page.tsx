import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { salesDocHref } from "@/lib/sales-docs/kinds";
import { EWAY_BILL_LIMIT } from "@/lib/transport";
import { todayInIndia } from "@/server/invoice-writes";
import { listEwayBills, type EwayRow } from "@/server/sales-docs";

export const metadata: Metadata = { title: "e-Way Bills" };

const hrefFor = (r: EwayRow) => (r.type === "invoice" ? `/invoices/${r.id}` : salesDocHref("challan", r.id));

function Rows({ rows, today, empty }: { rows: EwayRow[]; today: string; empty: string }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {rows.map((r) => (
        <li key={`${r.type}-${r.id}`}>
          <Link
            href={hrefFor(r)}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60"
          >
            <span className="truncate font-medium">{r.customerName}</span>
            <span className="text-right font-medium tabular-nums">{formatMoney(r.grandTotal)}</span>
            <span className="truncate text-xs text-muted-foreground">
              {r.type === "invoice" ? "Invoice" : "Challan"} <span className="font-mono">{r.number}</span> ·{" "}
              {formatDate(r.date)}
            </span>
            <span className="flex justify-end gap-1 text-xs">
              {r.ewayBillNo ? (
                <>
                  <span className="font-mono">{r.ewayBillNo}</span>
                  {r.ewayValidUntil &&
                    (r.ewayValidUntil < today ? (
                      <Badge variant="secondary">expired {formatDate(r.ewayValidUntil)}</Badge>
                    ) : (
                      <Badge variant="outline">till {formatDate(r.ewayValidUntil)}</Badge>
                    ))}
                </>
              ) : (
                <Badge variant="destructive">no e-way bill</Badge>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Lists() {
  const rows = await listEwayBills();
  const today = todayInIndia();
  const missing = rows.filter((r) => !r.ewayBillNo);
  const done = rows.filter((r) => r.ewayBillNo);
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Need an e-way bill ({missing.length})</h2>
        <Rows rows={missing} today={today} empty="Nothing is waiting for an e-way bill." />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">With an e-way bill ({done.length})</h2>
        <Rows rows={done} today={today} empty="No e-way bill numbers entered yet." />
      </section>
    </>
  );
}

export default function EwayBillsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold">e-Way Bills</h1>
      <p className="text-sm text-muted-foreground">
        Invoices and delivery challans of {formatMoney(EWAY_BILL_LIMIT)} or more normally need an e-way bill. Make it on
        the government e-way bill website, then open the invoice or challan here and type its number under “Transport
        and e-way bill”.
      </p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Lists />
      </Suspense>
    </div>
  );
}

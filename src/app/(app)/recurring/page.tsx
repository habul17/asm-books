import { FilePlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { RecurringActions } from "@/components/recurring/recurring-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/info-tip";
import { formatDate, formatMoney } from "@/lib/format";
import { FREQUENCY_LABELS, isDue } from "@/lib/recurring/schedule";
import { listRecurring } from "@/server/recurring";

export const metadata: Metadata = { title: "Recurring Invoices" };

async function List() {
  const { today, items } = await listRecurring();
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nothing repeats yet. Open an invoice you bill again and again, and press <strong>Repeat</strong>.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((r) => {
        const due = isDue(r, today);
        return (
          <li key={r.id} className={`flex flex-col gap-3 rounded-xl border p-4 ${r.active ? "" : "opacity-70"}`}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
              <Link href={`/customers?id=${r.customerId}`} className="truncate font-medium hover:underline">
                {r.customerName}
              </Link>
              <span className="text-right font-medium tabular-nums">{formatMoney(r.grandTotal)}</span>
              <span className="text-sm text-muted-foreground">
                {FREQUENCY_LABELS[r.frequency]} · like{" "}
                <Link href={`/invoices/${r.invoiceId}`} className="font-mono hover:underline">
                  {r.invoiceNumber}
                </Link>
              </span>
              <span className="flex justify-end">
                {!r.active ? (
                  <Badge variant="secondary">stopped</Badge>
                ) : due ? (
                  <Badge variant="destructive">due</Badge>
                ) : (
                  <Badge variant="outline">waiting</Badge>
                )}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {r.active && <>Next invoice: {formatDate(r.nextDate)} · </>}
              {r.made} made
              {r.lastInvoiceId != null && r.lastInvoiceNumber && (
                <>
                  , last{" "}
                  <Link href={`/invoices/${r.lastInvoiceId}`} className="font-mono hover:underline">
                    {r.lastInvoiceNumber}
                  </Link>
                </>
              )}
              {r.endDate && <> · stops after {formatDate(r.endDate)}</>}
              {r.notes && <> · {r.notes}</>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {due && (
                <Link href={`/invoices/new?repeat=${r.id}`} className={buttonVariants({ size: "sm" })}>
                  <FilePlusIcon /> Create invoice
                </Link>
              )}
              <RecurringActions id={r.id} active={r.active} due={due} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function RecurringPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">
        Recurring Invoices{" "}
        <InfoTip label="About recurring invoices">
          Bills you make again and again, like every month. When one is due, it shows here and in Reminders. Press{" "}
          <strong>Create invoice</strong>, check it and save. Nothing is billed on its own.
        </InfoTip>
      </h1>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <List />
      </Suspense>
    </div>
  );
}

import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { searchInvoices, type InvoiceFilters } from "@/server/invoices";

export async function InvoiceList({ filters }: { filters: InvoiceFilters }) {
  const { count, total, items } = await searchInvoices(filters);
  return (
    <section aria-label="Invoices" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count === items.length ? `${count} invoice${count === 1 ? "" : "s"}` : `Showing ${items.length} of ${count}`}
        {count > 0 && <> · total {formatMoney(total)}</>}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `No invoices match “${filters.query}”.` : "No invoices yet. Create your first one."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60",
                  inv.status === "cancelled" && "opacity-60",
                )}
              >
                <span className="truncate font-medium">{inv.customerName}</span>
                <span
                  className={cn("text-right font-medium tabular-nums", inv.status === "cancelled" && "line-through")}
                >
                  {formatMoney(inv.grandTotal)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{inv.number}</span> · {formatDate(inv.date)}
                </span>
                <span className="flex justify-end gap-1">
                  {inv.status === "cancelled" ? (
                    <Badge variant="destructive">cancelled</Badge>
                  ) : (
                    <Badge variant={inv.paymentType === "cash" ? "secondary" : "outline"}>{inv.paymentType}</Badge>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function InvoiceListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

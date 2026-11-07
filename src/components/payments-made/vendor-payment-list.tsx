import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_MODE_LABELS } from "@/lib/payments/validation";
import { searchVendorPayments, type VendorPaymentFilters } from "@/server/vendor-payments";

export async function VendorPaymentList({ filters, limit }: { filters: VendorPaymentFilters; limit?: number }) {
  const { count, total, items } = await searchVendorPayments(filters, limit);
  return (
    <section aria-label="Payments made" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count === items.length ? `${count} payment${count === 1 ? "" : "s"}` : `Showing ${items.length} of ${count}`}
        {count > 0 && <> · paid {formatMoney(total)}</>}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `No payments match “${filters.query}”.` : "No payments made yet."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/payments-made/${p.id}`}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60",
                  p.status === "cancelled" && "opacity-60",
                )}
              >
                <span className="truncate font-medium">{p.vendorName}</span>
                <span className={cn("text-right font-medium tabular-nums", p.status === "cancelled" && "line-through")}>
                  {formatMoney(p.amount)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{p.number}</span> · {formatDate(p.date)}
                  {p.reference && <> · {p.reference}</>}
                </span>
                <span className="flex justify-end">
                  {p.status === "cancelled" ? (
                    <Badge variant="destructive">cancelled</Badge>
                  ) : (
                    <Badge variant="secondary">{PAYMENT_MODE_LABELS[p.mode]}</Badge>
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

export function VendorPaymentListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

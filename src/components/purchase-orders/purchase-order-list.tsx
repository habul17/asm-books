import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import type { PurchaseOrderStatus } from "@/lib/purchase-orders/validation";
import { searchPurchaseOrders, type PurchaseOrderFilters } from "@/server/purchase-orders";

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <Badge variant={status === "cancelled" ? "destructive" : status === "open" ? "outline" : "secondary"}>{status}</Badge>
  );
}

export async function PurchaseOrderList({ filters, limit }: { filters: PurchaseOrderFilters; limit?: number }) {
  const { count, items } = await searchPurchaseOrders(filters, limit);
  return (
    <section aria-label="Purchase orders" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count === items.length ? `${count} purchase order${count === 1 ? "" : "s"}` : `Showing ${items.length} of ${count}`}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query
            ? `No purchase orders match “${filters.query}”.`
            : "No purchase orders yet. Make one when you order parts from a vendor."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((o) => (
            <li key={o.id}>
              <Link
                href={`/purchase-orders/${o.id}`}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60",
                  o.status === "cancelled" && "opacity-60",
                )}
              >
                <span className="truncate font-medium">{o.vendorName}</span>
                <span className={cn("text-right font-medium tabular-nums", o.status === "cancelled" && "line-through")}>
                  {formatMoney(o.grandTotal)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{o.number}</span> · {formatDate(o.date)}
                  {o.expectedDate && o.status === "open" && <> · expected {formatDate(o.expectedDate)}</>}
                </span>
                <span className="flex justify-end">
                  <PurchaseOrderStatusBadge status={o.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PurchaseOrderListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

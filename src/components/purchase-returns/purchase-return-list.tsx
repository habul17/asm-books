import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { searchPurchaseReturns, type PurchaseReturnFilters } from "@/server/purchase-returns";

export async function PurchaseReturnList({ filters }: { filters: PurchaseReturnFilters }) {
  const { count, total, items } = await searchPurchaseReturns(filters);
  return (
    <section aria-label="Purchase returns" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count === items.length ? `${count} return${count === 1 ? "" : "s"}` : `Showing ${items.length} of ${count}`}
        {count > 0 && <> · total {formatMoney(total)}</>}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `No returns match “${filters.query}”.` : "Nothing sent back to vendors yet."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                href={`/purchase-returns/${r.id}`}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60",
                  r.status === "cancelled" && "opacity-60",
                )}
              >
                <span className="truncate font-medium">{r.vendorName}</span>
                <span className={cn("text-right font-medium tabular-nums", r.status === "cancelled" && "line-through")}>
                  {formatMoney(r.grandTotal)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{r.number}</span> · {formatDate(r.date)} · {r.reason}
                  {r.billRef && <> · bill {r.billRef}</>}
                </span>
                <span className="flex justify-end">
                  {r.status === "cancelled" && <Badge variant="destructive">cancelled</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PurchaseReturnListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

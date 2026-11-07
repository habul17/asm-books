import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { searchBills, type BillFilters } from "@/server/bills";

export async function BillList({ filters, limit }: { filters: BillFilters; limit?: number }) {
  const { count, total, items } = await searchBills(filters, limit);
  return (
    <section aria-label="Bills" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count === items.length ? `${count} bill${count === 1 ? "" : "s"}` : `Showing ${items.length} of ${count}`}
        {count > 0 && <> · total {formatMoney(total)}</>}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `No bills match “${filters.query}”.` : "No bills yet. Enter one when parts arrive."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((b) => (
            <li key={b.id}>
              <Link
                href={`/bills/${b.id}`}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60",
                  b.status === "cancelled" && "opacity-60",
                )}
              >
                <span className="truncate font-medium">{b.vendorName}</span>
                <span className={cn("text-right font-medium tabular-nums", b.status === "cancelled" && "line-through")}>
                  {formatMoney(b.grandTotal)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{b.billNo}</span> · {formatDate(b.date)}
                  {b.dueDate && <> · due {formatDate(b.dueDate)}</>}
                </span>
                <span className="flex justify-end">
                  {b.status === "cancelled" && <Badge variant="destructive">cancelled</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BillListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

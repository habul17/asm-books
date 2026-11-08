import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatQty } from "@/lib/format";
import { searchAdjustments, type AdjustmentFilters } from "@/server/adjustments";

export async function AdjustmentList({ filters }: { filters: AdjustmentFilters }) {
  const { count, items } = await searchAdjustments(filters);
  return (
    <section aria-label="Inventory adjustments" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count === items.length ? `${count} adjustment${count === 1 ? "" : "s"}` : `Showing ${items.length} of ${count}`}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `No adjustments match “${filters.query}”.` : "No stock adjustments yet."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href={`/inventory-adjustments/${a.id}`}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60",
                  a.status === "cancelled" && "opacity-60",
                )}
              >
                <span className="truncate font-medium">{a.reason}</span>
                <span className={cn("text-right font-medium tabular-nums", a.status === "cancelled" && "line-through")}>
                  {a.netQty > 0 ? "+" : a.netQty < 0 ? "−" : ""}
                  {formatQty(Math.abs(a.netQty))}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{a.number}</span> · {formatDate(a.date)} · {a.lineCount} item
                  {a.lineCount === 1 ? "" : "s"}
                </span>
                <span className="flex justify-end">
                  {a.status === "cancelled" && <Badge variant="destructive">cancelled</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdjustmentListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

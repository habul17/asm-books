import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_MODE_LABELS } from "@/lib/payments/validation";
import { searchExpenses, type ExpenseFilters } from "@/server/expenses";

export async function ExpenseList({ filters, limit }: { filters: ExpenseFilters; limit?: number }) {
  const { count, total, items } = await searchExpenses(filters, limit);
  return (
    <section aria-label="Expenses" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count === items.length ? `${count} expense${count === 1 ? "" : "s"}` : `Showing ${items.length} of ${count}`}
        {count > 0 && <> · spent {formatMoney(total)}</>}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `No expenses match “${filters.query}”.` : "No expenses recorded yet."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/expenses/${p.id}`}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60",
                  p.status === "cancelled" && "opacity-60",
                )}
              >
                <span className="truncate font-medium">{p.category}</span>
                <span className={cn("text-right font-medium tabular-nums", p.status === "cancelled" && "line-through")}>
                  {formatMoney(p.amount)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{p.number}</span> · {formatDate(p.date)}
                  {p.paidTo && <> · {p.paidTo}</>}
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

export function ExpenseListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

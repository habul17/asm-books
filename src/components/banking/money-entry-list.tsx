import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MONEY_KIND_INFO } from "@/lib/banking/entries";
import { formatDate, formatMoney } from "@/lib/format";
import { PAYMENT_MODE_LABELS } from "@/lib/payments/validation";
import { searchMoneyEntries, type MoneyEntryFilters } from "@/server/money-entries";

const SIGN = { in: "+ ", out: "− ", transfer: "" } as const;

export async function MoneyEntryList({ filters }: { filters: MoneyEntryFilters }) {
  const { count, items } = await searchMoneyEntries(filters);
  return (
    <section aria-label="Banking entries" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count === items.length ? `${count} entr${count === 1 ? "y" : "ies"}` : `Showing ${items.length} of ${count}`}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query
            ? `No entries match “${filters.query}”.`
            : "Nothing entered yet. Add the owner's own money, loans, GST paid and cash put in the bank here."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((e) => {
            const info = MONEY_KIND_INFO[e.kind];
            const cancelled = e.status === "cancelled";
            return (
              <li key={e.id}>
                <Link
                  href={`/banking/${e.id}`}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60",
                    cancelled && "opacity-60",
                  )}
                >
                  <span className="truncate font-medium">{info.label}</span>
                  <span className={cn("text-right font-medium tabular-nums", cancelled && "line-through")}>
                    {SIGN[info.flow]}
                    {formatMoney(e.amount)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatDate(e.date)}
                    {e.party && <> · {e.party}</>}
                  </span>
                  <span className="flex justify-end">
                    {cancelled ? (
                      <Badge variant="destructive">cancelled</Badge>
                    ) : (
                      e.mode && <Badge variant="secondary">{PAYMENT_MODE_LABELS[e.mode]}</Badge>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function MoneyEntryListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

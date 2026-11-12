import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import { SALES_DOC_KIND, salesDocHref, type SalesDocKind, type SalesDocStatus } from "@/lib/sales-docs/kinds";
import { searchSalesDocs, type SalesDocFilters } from "@/server/sales-docs";

export function SalesDocStatusBadge({ status }: { status: SalesDocStatus }) {
  return (
    <Badge variant={status === "cancelled" ? "destructive" : status === "open" ? "outline" : "secondary"}>{status}</Badge>
  );
}

export async function SalesDocList({ kind, filters }: { kind: SalesDocKind; filters: SalesDocFilters }) {
  const { count, items } = await searchSalesDocs(kind, filters);
  const { noun, plural } = SALES_DOC_KIND[kind];
  return (
    <section aria-label={plural} className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {count === items.length ? `${count} ${noun}${count === 1 ? "" : "s"}` : `Showing ${items.length} of ${count}`}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `Nothing matches “${filters.query}”.` : `No ${plural.toLowerCase()} yet. Create your first one.`}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((d) => (
            <li key={d.id}>
              <Link
                href={salesDocHref(kind, d.id)}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-muted/60",
                  d.status === "cancelled" && "opacity-60",
                )}
              >
                <span className="truncate font-medium">{d.customerName}</span>
                <span className={cn("text-right font-medium tabular-nums", d.status === "cancelled" && "line-through")}>
                  {formatMoney(d.grandTotal)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{d.number}</span> · {formatDate(d.date)}
                </span>
                <span className="flex justify-end">
                  <SalesDocStatusBadge status={d.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SalesDocListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { customersHref } from "@/lib/customers/href";
import { searchCustomers, type CustomerFilters } from "@/server/customers";

import { Balance } from "./balance";

export async function CustomerList({
  filters,
  selectedId,
}: {
  filters: CustomerFilters;
  selectedId: number | "new" | null;
}) {
  const { total, items } = await searchCustomers(filters);
  const link = (id: number) =>
    customersHref({ q: filters.query, group: filters.groupId, inactive: filters.showInactive, id });

  return (
    <section aria-label="Customers" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === items.length
          ? `${total} customer${total === 1 ? "" : "s"}`
          : `Showing ${items.length} of ${total} — type more to narrow down`}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `No customers match “${filters.query}”.` : "No customers yet. Add your first one."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={link(c.id)}
                scroll={false}
                data-customer-result
                aria-current={selectedId === c.id ? "true" : undefined}
                className={cn(
                  "flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/60",
                  selectedId === c.id && "bg-muted",
                  !c.active && "opacity-60",
                )}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5 font-medium">
                    {c.name}
                    {!c.active && <Badge variant="outline">inactive</Badge>}
                    {c.groupName && <Badge variant="secondary">{c.groupName}</Badge>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[c.mobile, c.city, c.gstin].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <Balance amount={c.balance} className="shrink-0 text-sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CustomerListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-24" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}

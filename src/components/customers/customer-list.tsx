import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { customersHref } from "@/lib/customers/href";
import { formatMoney } from "@/lib/format";
import { searchCustomers, type CustomerFilters } from "@/server/customers";

/** The amount on a row: what they owe, "Settled", or what we owe them. */
function RowBalance({ amount }: { amount: number }) {
  if (Math.abs(amount) < 0.005) return <span className="shrink-0 text-sm text-muted-foreground">Settled</span>;
  if (amount < 0) {
    return <span className="shrink-0 text-sm font-medium text-good tabular-nums">To pay {formatMoney(-amount)}</span>;
  }
  return <span className="shrink-0 font-semibold tabular-nums">{formatMoney(amount)}</span>;
}

/**
 * Customers by name only, most money to receive first. Mobile, city and GSTIN stay on the
 * customer's own page (search still finds them).
 */
export async function CustomerList({
  filters,
  selectedId,
}: {
  filters: CustomerFilters;
  selectedId: number | "new" | null;
}) {
  const { total, toReceive, items } = await searchCustomers(filters);
  const link = (id: number) =>
    customersHref({ q: filters.query, group: filters.groupId, inactive: filters.showInactive, id });

  return (
    <section aria-label="Customers" className="flex flex-col gap-3">
      {/* One line on a laptop, so the list's card lines up with the customer's card beside it. */}
      <p className="px-1 text-sm text-muted-foreground md:truncate" aria-live="polite">
        {total === items.length
          ? `${total} customer${total === 1 ? "" : "s"}`
          : `Showing ${items.length} of ${total} — type more to narrow down`}
        {toReceive > 0 && (
          <>
            {" · "}
            <span className="font-medium text-foreground tabular-nums">{formatMoney(toReceive)}</span> to receive
          </>
        )}
      </p>
      {items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-foreground/15 p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `No customers match “${filters.query}”.` : "No customers yet. Add your first one."}
        </p>
      ) : (
        <ul className="glass divide-y divide-foreground/[0.07] overflow-hidden rounded-3xl">
          {items.map((c) => {
            const selected = selectedId === c.id;
            return (
              <li key={c.id}>
                <Link
                  href={link(c.id)}
                  scroll={false}
                  data-customer-result
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.04] sm:px-5",
                    selected && "bg-white/80 hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/10",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        "line-clamp-2 font-medium break-words",
                        selected && "text-tint dark:text-foreground",
                        !c.active && "text-muted-foreground",
                      )}
                    >
                      {c.name}
                    </span>
                    {!c.active && <Badge variant="outline">inactive</Badge>}
                  </span>
                  <RowBalance amount={c.balance} />
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/70 md:hidden" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function CustomerListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="mx-1 h-4 w-40" />
      <Skeleton className="h-[28rem] rounded-3xl" />
    </div>
  );
}

import Link from "next/link";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { searchVendors, type VendorFilters } from "@/server/vendors";

import { VendorBalance } from "./vendor-balance";

export async function VendorList({ filters }: { filters: VendorFilters }) {
  const { total, items } = await searchVendors(filters);
  return (
    <section aria-label="Vendors" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === items.length
          ? `${total} vendor${total === 1 ? "" : "s"}`
          : `Showing ${items.length} of ${total} — type more to narrow down`}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filters.query ? `No vendors match “${filters.query}”.` : "No vendors yet. Add the suppliers you buy from."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((v) => (
            <li key={v.id}>
              <Link
                href={`/vendors/${v.id}`}
                className={cn("flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/60", !v.active && "opacity-60")}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5 font-medium">
                    {v.name}
                    {!v.active && <Badge variant="outline">inactive</Badge>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[v.mobile, v.city, v.gstin].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <VendorBalance amount={v.balance} className="shrink-0 text-sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function VendorListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-24" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}

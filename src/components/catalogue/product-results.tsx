import Link from "next/link";
import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { searchProducts } from "@/server/catalogue";

function href(query: string, id?: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (id) params.set("id", String(id));
  const qs = params.toString();
  return qs ? `/catalogue?${qs}` : "/catalogue";
}

export { href as catalogueHref };

export async function ProductResults({ query, selectedId }: { query: string; selectedId: number | null }) {
  const { total, items } = await searchProducts(query);

  return (
    <section aria-label="Search results" className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === items.length
          ? `${total} product${total === 1 ? "" : "s"}`
          : `Showing ${items.length} of ${total} — type more to narrow down`}
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No products match “{query}”.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {items.map((p) => {
            const selected = p.id === selectedId;
            return (
              <li key={p.id}>
                <Link
                  href={href(query, p.id)}
                  scroll={false}
                  data-product-result
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
                    selected && "bg-muted",
                  )}
                >
                  <span className={cn("truncate font-mono font-semibold", !p.active && "text-muted-foreground line-through")}>
                    {p.partNo}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{p.description}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {!p.active && <span className="font-medium text-destructive">Switched off · </span>}
                      {[p.categoryGroup, p.category].filter(Boolean).join(" › ")}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">{formatMoney(p.purchasePrice)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ProductResultsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-5 w-32" />
      <div className="divide-y rounded-xl border">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

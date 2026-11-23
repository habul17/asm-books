import Link from "next/link";
import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatQty } from "@/lib/format";
import { ITEMS_SHOWS, type ItemStatus, type ItemsShow } from "@/lib/stock/item-status";
import { searchProducts } from "@/server/catalogue";

import { PartPhoto } from "./part-photo";

function href(query: string, id?: number, show: ItemsShow = "all") {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (show !== "all") params.set("show", show);
  if (id) params.set("id", String(id));
  const qs = params.toString();
  return qs ? `/catalogue?${qs}` : "/catalogue";
}

export { href as catalogueHref };

const STATUS_TEXT: Record<ItemStatus, string | null> = { out: "out", buy: "buy soon", slow: "slow", ok: null };
const STATUS_COLOR: Record<ItemStatus, string> = {
  out: "text-destructive",
  buy: "text-destructive",
  slow: "text-amber-700 dark:text-amber-400",
  ok: "",
};

const EMPTY: Record<ItemsShow, string> = {
  all: "No parts match",
  buy: "Nothing is about to run out",
  out: "Nothing is out of stock",
  slow: "No slow parts",
};

/** All · Buy soon · Out · Slow, one bar. Keeps the search, drops the open part. */
export function ItemsTabs({ query, show }: { query: string; show: ItemsShow }) {
  return (
    <nav aria-label="Show" className="grid grid-cols-4 gap-0.5 rounded-xl border p-0.5 text-sm">
      {ITEMS_SHOWS.map((s) => (
        <Link
          key={s.value}
          href={href(query, undefined, s.value)}
          scroll={false}
          replace
          aria-current={s.value === show ? "page" : undefined}
          className={cn(
            "flex h-9 items-center justify-center rounded-[10px] transition-colors",
            s.value === show ? "bg-foreground font-semibold text-background" : "text-foreground hover:bg-muted/60",
          )}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

const COLUMNS = "grid grid-cols-[2.75rem_minmax(0,1fr)_3.5rem_5.25rem] gap-2.5";

export async function ProductResults({
  query,
  selectedId,
  show,
}: {
  query: string;
  selectedId: number | null;
  show: ItemsShow;
}) {
  const { total, items } = await searchProducts(query, undefined, show);

  return (
    <section aria-label="Search results" className="flex flex-col">
      <div
        className={cn(
          COLUMNS,
          "border-b px-1 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase",
        )}
      >
        <span />
        <span>Part</span>
        <span className="text-right">Stock</span>
        <span className="text-right">Price</span>
      </div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {EMPTY[show]}
          {query ? ` “${query}”` : ""}.
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map((p) => {
            const selected = p.id === selectedId;
            const tag = STATUS_TEXT[p.status];
            return (
              <li key={p.id}>
                <Link
                  href={href(query, p.id, show)}
                  scroll={false}
                  data-product-result
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    COLUMNS,
                    "items-center border-b px-1 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted focus-visible:outline-none",
                    selected && "bg-muted",
                  )}
                >
                  <PartPhoto photo={p.photo} className="size-11 rounded-[10px]" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span
                      className={cn(
                        "text-[15px] leading-snug font-semibold break-words",
                        !p.active && "text-muted-foreground line-through",
                      )}
                    >
                      {p.description}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {!p.active && <span className="font-medium text-destructive">Switched off · </span>}
                      {[p.partNo, p.category].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex flex-col items-end tabular-nums">
                    <span className={cn("text-[15px]", tag ? "font-bold" : "font-medium", STATUS_COLOR[p.status])}>
                      {formatQty(p.stockQty)}
                    </span>
                    <span className={cn("text-[11px]", tag ? cn("font-semibold", STATUS_COLOR[p.status]) : "text-muted-foreground")}>
                      {tag ?? p.unit}
                    </span>
                  </span>
                  <span className="flex flex-col items-end tabular-nums">
                    <span className="text-[15px] font-semibold">{formatMoney(p.price)}</span>
                    {p.cost != null && <span className="text-[11px] text-muted-foreground">cost {formatMoney(p.cost)}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {total > items.length && (
        <p className="pt-3 text-center text-xs text-muted-foreground" aria-live="polite">
          Showing {items.length} of {total.toLocaleString("en-IN")}. Type to narrow down.
        </p>
      )}
    </section>
  );
}

export function ProductResultsSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="mb-2 h-4 w-full" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b py-2.5">
          <Skeleton className="size-11 rounded-[10px]" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-10" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

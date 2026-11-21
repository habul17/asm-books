"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { PartPhoto } from "@/components/catalogue/part-photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, formatQty } from "@/lib/format";
import { filterStock, type StockRow, type StockShow, type StockSort } from "@/lib/stock/filter";

const PAGE = 100;

const SHOWS: { value: StockShow; label: string }[] = [
  { value: "in", label: "In stock" },
  { value: "out", label: "Out of stock" },
  { value: "all", label: "All parts" },
];

/** Every part's stock, searchable, with what it cost (owner only). */
export function StockList({ items, owner }: { items: StockRow[]; owner: boolean }) {
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<StockShow>("in");
  const [sort, setSort] = useState<StockSort>(owner ? "value" : "qty");
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query);

  const rows = useMemo(() => filterStock(items, { query: q, show, sort }), [items, q, show, sort]);
  const totalValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const noCost = owner ? rows.filter((r) => r.stockQty > 0 && r.cost == null).length : 0;
  const shown = rows.slice(0, limit);

  return (
    <div className="flex flex-col gap-3">
      {owner && (
        <div className="flex flex-col gap-0.5 rounded-2xl border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">Total cost of {show === "all" ? "all parts" : "this stock"}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(totalValue)}</p>
          <p className="text-xs text-muted-foreground">
            {rows.length} part{rows.length === 1 ? "" : "s"} · at each part&rsquo;s newest purchase price
            {noCost > 0 && ` · ${noCost} in stock with no purchase price yet (counted as ₹0)`}
          </p>
        </div>
      )}

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Search part no or name"
          aria-label="Search stock"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SHOWS.map((s) => (
          <Button
            key={s.value}
            type="button"
            size="sm"
            variant={show === s.value ? "default" : "outline"}
            aria-pressed={show === s.value}
            onClick={() => {
              setShow(s.value);
              setLimit(PAGE);
            }}
          >
            {s.label}
          </Button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as StockSort)}
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
          >
            {owner && <option value="value">Highest cost</option>}
            <option value="qty">Most stock</option>
            <option value="partNo">Part no</option>
          </select>
        </label>
      </div>

      {!owner && (
        <p className="text-sm text-muted-foreground">
          {rows.length} part{rows.length === 1 ? "" : "s"}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {query ? `No parts match “${query}”.` : "No parts here."}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {shown.map((r) => (
            <li key={r.id}>
              <Link
                href={`/catalogue?id=${r.id}`}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
              >
                <PartPhoto photo={r.photo} />
                <span className="min-w-0">
                  <span className="line-clamp-2 break-words">
                    <span className="font-mono font-semibold">{r.partNo}</span> {r.description}
                  </span>
                  <span className={`block text-xs tabular-nums ${r.stockQty < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {formatQty(r.stockQty)} {r.unit}
                    {owner && (r.cost != null ? ` × ${formatMoney(r.cost)}` : " · no purchase price")}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  {owner ? (
                    <span className="font-medium">{formatMoney(r.value)}</span>
                  ) : (
                    <span className="font-medium">
                      {formatQty(r.stockQty)} <span className="text-xs text-muted-foreground">{r.unit}</span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {rows.length > shown.length && (
        <Button type="button" variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
          Show more ({rows.length - shown.length} left)
        </Button>
      )}
    </div>
  );
}

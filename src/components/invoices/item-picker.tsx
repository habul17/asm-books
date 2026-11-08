"use client";

import { SearchIcon } from "lucide-react";
import { useId, useState, type RefObject } from "react";

import { findItems } from "@/app/(app)/invoices/actions";
import { Input } from "@/components/ui/input";
import { formatMoney, formatQty } from "@/lib/format";
import type { PickedItem } from "@/server/invoices";

import { useLookup } from "./use-lookup";

/** What the picker shows for each part; `price` is left out where no price applies. */
interface PickerItem {
  id: number;
  partNo: string | null;
  description: string;
  stockQty: number;
  price?: number | null;
}

/**
 * Search box that adds a part to the invoice. Enter adds the highlighted part.
 * `search` replaces the default lookup (selling prices from the price list).
 */
export function ItemPicker<T extends PickerItem = PickedItem>({
  priceListId = null,
  search,
  onPick,
  inputRef,
}: {
  priceListId?: number | null;
  search?: (query: string) => Promise<T[]>;
  onPick: (item: T) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { results, loading } = useLookup<T>(query, search ?? ((q) => findItems(q, priceListId) as unknown as Promise<T[]>));
  const shown = open && query.trim() !== "";

  const pick = (item: T | undefined) => {
    if (!item) return;
    onPick(item);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-label="Add part"
        placeholder="Add part: type part no or name…"
        className="pl-8"
        value={query}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {shown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{loading ? "Searching…" : "No parts found"}</li>
          ) : (
            results.map((item, i) => (
              <li
                key={item.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(item)}
                className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm ${i === active ? "bg-muted" : ""}`}
              >
                <span className="w-16 shrink-0 font-mono text-xs">{item.partNo}</span>
                <span className="min-w-0 flex-1 truncate">{item.description}</span>
                <span
                  className={`shrink-0 text-xs text-muted-foreground ${"price" in item ? "hidden sm:inline" : "tabular-nums"}`}
                >
                  stock {formatQty(item.stockQty)}
                </span>
                {"price" in item && (
                  <span className="w-20 shrink-0 text-right tabular-nums">
                    {item.price != null ? formatMoney(item.price) : "—"}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

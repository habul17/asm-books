"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";

import { findCustomers } from "@/app/(app)/invoices/actions";
import { Balance } from "@/components/customers/balance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PickedCustomer } from "@/server/invoices";

import { useLookup } from "./use-lookup";

export function CustomerPicker({
  value,
  onChange,
}: {
  value: PickedCustomer | null;
  onChange: (c: PickedCustomer | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { results, loading } = useLookup(query, findCustomers, { minLength: 0 });

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{value.name}</p>
          <p className="text-xs text-muted-foreground">
            {[value.city, value.mobile].filter(Boolean).join(" · ") || "—"} · Balance <Balance amount={value.balance} />
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          <XIcon /> Change
        </Button>
      </div>
    );
  }

  const choose = (c: PickedCustomer | undefined) => {
    if (!c) return;
    onChange(c);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Customer"
        placeholder="Search customer by name, mobile or city…"
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
            choose(results[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {loading ? "Searching…" : "No customers found. Add them in Customers first."}
            </li>
          ) : (
            results.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(c)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${i === active ? "bg-muted" : ""}`}
              >
                <span className="min-w-0 truncate">
                  {c.name}
                  {c.city && <span className="text-muted-foreground"> · {c.city}</span>}
                </span>
                <Balance amount={c.balance} className="shrink-0 text-xs" />
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

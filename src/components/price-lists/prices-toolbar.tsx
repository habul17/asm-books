"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { priceListsHref } from "@/lib/price-lists/href";

const DEBOUNCE_MS = 200;

export function PricesToolbar({
  listId,
  query,
  manualOnly,
  manualCount,
}: {
  listId: number;
  query: string;
  manualOnly: boolean;
  manualCount: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (q: string, manual: boolean) =>
    startTransition(() => router.replace(priceListsHref({ list: listId, q: q.trim(), manual }), { scroll: false }));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => go(next, manualOnly), DEBOUNCE_MS);
          }}
          placeholder="Search products in this list…"
          aria-label="Search products in this list"
          autoComplete="off"
          aria-busy={pending}
          className="pl-9"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={manualOnly}
          onChange={(e) => go(value, e.target.checked)}
          className="size-4 accent-primary"
        />
        Only manual prices ({manualCount})
      </label>
    </div>
  );
}

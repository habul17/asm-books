"use client";

import { SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { customersHref } from "@/lib/customers/href";

const DEBOUNCE_MS = 200;

export function CustomerToolbar({ groups }: { groups: { id: number; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const group = Number(searchParams.get("group")) || null;
  const inactive = searchParams.get("inactive") === "1";
  const id = searchParams.get("id");
  const selected = id === "new" ? "new" : Number(id) || null;

  const go = (next: { q?: string; group?: number | null; inactive?: boolean }) =>
    startTransition(() =>
      router.replace(
        customersHref({
          q: (next.q ?? value).trim(),
          group: next.group === undefined ? group : next.group,
          inactive: next.inactive ?? inactive,
          id: selected,
        }),
        { scroll: false },
      ),
    );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-60 flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => go({ q: next }), DEBOUNCE_MS);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            document.querySelector<HTMLAnchorElement>("[data-customer-result]")?.click();
          }}
          placeholder="Search name, mobile, GSTIN or city…"
          aria-label="Search customers"
          autoComplete="off"
          aria-busy={pending}
          className="h-10 pl-9 text-base"
        />
      </div>
      {groups.length > 0 && (
        <NativeSelect
          aria-label="Filter by group"
          value={group ?? ""}
          onChange={(e) => go({ group: Number(e.target.value) || null })}
          className="min-w-40"
        >
          <NativeSelectOption value="">All groups</NativeSelectOption>
          {groups.map((g) => (
            <NativeSelectOption key={g.id} value={g.id}>
              {g.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={inactive}
          onChange={(e) => go({ inactive: e.target.checked })}
          className="size-4 accent-primary"
        />
        Show inactive
      </label>
    </div>
  );
}

"use client";

import { SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { listHref } from "@/lib/list-href";

const DEBOUNCE_MS = 200;

/** Search box plus an "all / active / cancelled" filter, kept in the URL. */
export function ListToolbar({
  path,
  placeholder,
  label,
  statusLabels,
}: {
  path: string;
  placeholder: string;
  label: string;
  /** Option text for "all", "final" and "cancelled"; leave out to hide the filter. */
  statusLabels?: { all: string; final: string; cancelled: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const status = searchParams.get("status") ?? "all";
  const go = (next: { q?: string; status?: string }) =>
    startTransition(() =>
      router.replace(listHref(path, { q: (next.q ?? value).trim(), status: next.status ?? status }), { scroll: false }),
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
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
          aria-busy={pending}
          className="h-10 pl-9 text-base"
        />
      </div>
      {statusLabels && (
        <NativeSelect aria-label="Status" value={status} onChange={(e) => go({ status: e.target.value })}>
          <NativeSelectOption value="all">{statusLabels.all}</NativeSelectOption>
          <NativeSelectOption value="final">{statusLabels.final}</NativeSelectOption>
          <NativeSelectOption value="cancelled">{statusLabels.cancelled}</NativeSelectOption>
        </NativeSelect>
      )}
    </div>
  );
}

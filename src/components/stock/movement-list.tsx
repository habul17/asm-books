"use client";

import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { PartPhoto } from "@/components/catalogue/part-photo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQty } from "@/lib/format";
import {
  BUY_SOON_DAYS,
  MOVEMENT_PERIODS,
  movementView,
  periodLabel,
  withPace,
  type MovementInput,
  type MovementPeriod,
  type MovementRow,
  type MovementView,
} from "@/lib/stock/movement";

const PAGE = 100;

const VIEWS: { value: MovementView; label: string; help: (p: string) => string }[] = [
  { value: "fast", label: "Fast selling", help: (p) => `Parts that sold in the last ${p}, the most sold first.` },
  {
    value: "buy",
    label: "Buy soon",
    help: () => `Selling parts whose stock runs out within ${BUY_SOON_DAYS} days at this pace, or is already out.`,
  },
  { value: "slow", label: "Slow selling", help: (p) => `Parts on the shelf that sold least in the last ${p}; not sold at all first.` },
];

function Change({ row }: { row: MovementRow }) {
  if (row.sold <= 0) return null;
  if (row.change == null) return <span className="text-xs text-muted-foreground">new</span>;
  const pct = Math.round(Math.abs(row.change) * 100);
  if (pct === 0) return <span className="text-xs text-muted-foreground">same</span>;
  const up = row.change > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
      {up ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />}
      {pct}%
    </span>
  );
}

function stockText(r: MovementRow) {
  const stock = `Stock ${formatQty(r.stockQty)} ${r.unit}`;
  if (r.stockQty <= 0) return r.sold > 0 ? `${stock} · out of stock` : stock;
  if (r.daysLeft == null) return stock;
  if (r.daysLeft > 365) return `${stock} · lasts over a year`;
  return `${stock} · lasts about ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}`;
}

/** Which parts sell fast and which sit, compared with the period before, to decide what to buy. */
export function MovementList({ rows: input, days }: { rows: MovementInput[]; days: MovementPeriod }) {
  const [view, setView] = useState<MovementView>("fast");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query);
  const label = periodLabel(days);

  const rows = useMemo(() => withPace(input, days), [input, days]);
  const counts = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.value, movementView(rows, v.value).length])) as Record<MovementView, number>,
    [rows],
  );
  const list = useMemo(() => movementView(rows, view, q), [rows, view, q]);
  const shown = list.slice(0, limit);
  const current = VIEWS.find((v) => v.value === view)!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted-foreground">Sold in the last</span>
        <div className="grid grid-cols-4 gap-1.5">
          {MOVEMENT_PERIODS.map((p) => (
            <Link
              key={p}
              href={`/fast-slow?days=${p}`}
              scroll={false}
              aria-current={p === days ? "page" : undefined}
              className={buttonVariants({ size: "sm", variant: p === days ? "default" : "outline" })}
            >
              {periodLabel(p)}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {VIEWS.map((v) => (
          <Button
            key={v.value}
            type="button"
            variant={view === v.value ? "default" : "outline"}
            aria-pressed={view === v.value}
            className="h-auto flex-col gap-0 py-2"
            onClick={() => {
              setView(v.value);
              setLimit(PAGE);
            }}
          >
            <span className="text-lg font-semibold tabular-nums">{counts[v.value]}</span>
            <span className="text-xs">{v.label}</span>
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {current.help(label)} Arrows compare with the {label} before.
      </p>

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
          aria-label="Search parts"
          className="pl-9"
        />
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {query ? `No parts match “${query}”.` : view === "buy" ? "Nothing is about to run out." : "No parts here."}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {shown.map((r, i) => (
            <li key={r.id}>
              <Link
                href={`/catalogue?id=${r.id}`}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60"
              >
                <PartPhoto photo={r.photo} />
                <span className="min-w-0">
                  <span className="line-clamp-2 break-words">
                    {view === "fast" && <span className="mr-1 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>}
                    <span className="font-mono font-semibold">{r.partNo}</span> {r.description}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {r.sold > 0
                      ? `${formatQty(r.perMonth >= 10 ? Math.round(r.perMonth) : r.perMonth)} a month · ${r.bills} bill${r.bills === 1 ? "" : "s"}, ${r.customers} customer${r.customers === 1 ? "" : "s"}`
                      : `Not sold in the last ${label}`}
                  </span>
                  <span
                    className={`block text-xs tabular-nums ${r.sold > 0 && r.daysLeft != null && r.daysLeft < BUY_SOON_DAYS ? "font-medium text-destructive" : "text-muted-foreground"}`}
                  >
                    {stockText(r)}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-0.5 text-right tabular-nums">
                  <span className="font-medium">
                    {formatQty(Math.max(0, r.sold))} <span className="text-xs text-muted-foreground">{r.unit}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">sold</span>
                  <Change row={r} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {list.length > shown.length && (
        <Button type="button" variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
          Show more ({list.length - shown.length} left)
        </Button>
      )}
    </div>
  );
}

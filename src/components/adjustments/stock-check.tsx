"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useState, useTransition } from "react";

import { saveStockCheck } from "@/app/(app)/inventory-adjustments/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQty } from "@/lib/format";
import type { StockListItem } from "@/server/adjustments";

/** Counts typed so far, kept on this device so a long count survives leaving the page. */
const KEY = "asm-stock-check";
/** Rows drawn at once; searching narrows the rest. */
const SHOWN = 150;

type Show = "stock" | "all" | "counted";

function loadDraft(): Record<number, string> {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function keepDraft(d: Record<number, string>) {
  try {
    if (Object.keys(d).length) localStorage.setItem(KEY, JSON.stringify(d));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked; the counts still work until the page is left.
  }
}

/** A typed count as a number, or null when empty or not a valid count. */
const countOf = (s: string | undefined) => {
  if (s == null || s.trim() === "") return null;
  const n = Number(s.trim());
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 1000) / 1000 : NaN;
};

export function StockCheck({ parts }: { parts: StockListItem[] }) {
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("stock");
  const [message, setMessage] = useState<{ ok: boolean; text: string; ids?: number[] } | null>(null);
  const [saving, startSaving] = useTransition();

  // Pick up counts left from an earlier visit on this device.
  useEffect(() => {
    const draft = loadDraft();
    if (Object.keys(draft).length) startTransition(() => setCounts(draft));
  }, []);

  const setCount = (id: number, value: string) =>
    setCounts((c) => {
      const next = { ...c };
      if (value.trim() === "") delete next[id];
      else next[id] = value;
      keepDraft(next);
      return next;
    });

  const inStock = useMemo(() => parts.filter((p) => p.stockQty !== 0).length, [parts]);
  const typed = Object.keys(counts).length;

  const list = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return parts.filter((p) => {
      if (show === "stock" && p.stockQty === 0 && counts[p.id] == null) return false;
      if (show === "counted" && counts[p.id] == null) return false;
      const text = `${p.partNo} ${p.description}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [parts, query, show, counts]);

  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const entries = Object.entries(counts).map(([id, v]) => ({ part: byId.get(Number(id)), n: countOf(v) }));
  const bad = entries.filter((e) => e.part && Number.isNaN(e.n));
  const differ = entries.filter((e) => e.part && e.n != null && !Number.isNaN(e.n) && e.n !== e.part.stockQty);

  const save = () => {
    if (!differ.length || bad.length) return;
    const input = { counts: differ.map((e) => ({ productId: e.part!.id, counted: e.n! })) };
    startSaving(async () => {
      const res = await saveStockCheck(input).catch(() => ({ error: "Could not save. Check your internet and try again." }));
      if (res.error !== undefined) return setMessage({ ok: false, text: res.error });
      keepDraft({});
      setCounts({});
      const n = "changed" in res ? (res.changed ?? 0) : 0;
      setMessage({
        ok: true,
        text: n ? `Saved: stock corrected for ${n} part${n === 1 ? "" : "s"}.` : "Every count already matches the app.",
        ids: "saved" in res ? res.saved : [],
      });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Compare each part with the shelf. Type the shelf count only where it is different, then save. Parts you leave empty are not
        changed.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search parts"
            placeholder="Search part no or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex self-start rounded-lg bg-muted p-0.5 text-sm" role="radiogroup" aria-label="Parts to show">
          {(
            [
              ["stock", `In stock (${inStock})`],
              ["all", `All parts (${parts.length})`],
              ["counted", `Typed (${typed})`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={show === v}
              onClick={() => setShow(v)}
              className={`rounded-md px-2.5 py-1 ${show === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "" : "text-destructive"}`}>
          {message.text}{" "}
          {message.ids?.map((id, i) => (
            <Link key={id} href={`/inventory-adjustments/${id}`} className="mr-2 underline underline-offset-4">
              {message.ids!.length > 1 ? `Open part ${i + 1}` : "Open the adjustment"}
            </Link>
          ))}
        </p>
      )}

      <section aria-label="Stock" className="divide-y rounded-xl border">
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_6rem] items-center gap-3 px-3 py-2 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_5rem_7rem_4rem]">
          <span>Part</span>
          <span className="text-right">In app</span>
          <span className="text-right">On shelf</span>
          <span className="hidden text-right sm:block">Change</span>
        </div>
        {list.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {show === "stock" && !query ? "No part has stock in the app. Choose All parts to count them." : "No parts match."}
          </p>
        )}
        {list.slice(0, SHOWN).map((p) => {
          const n = countOf(counts[p.id]);
          const diff = n == null || Number.isNaN(n) ? null : Math.round((n - p.stockQty) * 1000) / 1000;
          return (
            <div
              key={p.id}
              className="grid grid-cols-[minmax(0,1fr)_4.5rem_6rem] items-center gap-3 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_5rem_7rem_4rem]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{p.partNo}</p>
                <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                {diff != null && diff !== 0 && (
                  <p className="text-xs tabular-nums sm:hidden">
                    {diff > 0 ? "+" : "−"}
                    {formatQty(Math.abs(diff))} {p.unit}
                  </p>
                )}
              </div>
              <span className="text-right tabular-nums">{formatQty(p.stockQty)}</span>
              <Input
                aria-label={`On shelf for ${p.partNo}`}
                inputMode="decimal"
                value={counts[p.id] ?? ""}
                onChange={(e) => setCount(p.id, e.target.value)}
                aria-invalid={n != null && Number.isNaN(n)}
                className="h-8 text-right tabular-nums"
              />
              <span className="hidden text-right text-xs tabular-nums sm:block">
                {diff == null ? "" : diff === 0 ? "matches" : `${diff > 0 ? "+" : "−"}${formatQty(Math.abs(diff))}`}
              </span>
            </div>
          );
        })}
        {list.length > SHOWN && (
          <p className="p-3 text-center text-xs text-muted-foreground">
            Showing {SHOWN} of {list.length}. Search to find the rest.
          </p>
        )}
      </section>

      {/* On phones the menu floats at the bottom, so the bar sits just above it. */}
      <div className="sticky bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.25rem)] z-10 rounded-xl border bg-background/95 px-3 py-2 shadow-sm backdrop-blur md:bottom-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" aria-live="polite">
            {bad.length ? (
              <span className="text-destructive">
                Fix the count for {bad.map((e) => e.part!.partNo).join(", ")}
              </span>
            ) : (
              <>
                {typed} typed · <span className="font-medium">{differ.length} to correct</span>
              </>
            )}
          </p>
          <div className="flex gap-2">
            {typed > 0 && (
              <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setCounts(() => (keepDraft({}), {}))}>
                Clear counts
              </Button>
            )}
            <Button type="button" size="sm" disabled={saving || !differ.length || bad.length > 0} onClick={save}>
              {saving ? "Saving…" : `Save ${differ.length} correction${differ.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>
      <Link href="/inventory-adjustments" className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
        Back to adjustments
      </Link>
    </div>
  );
}

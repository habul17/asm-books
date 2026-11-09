"use client";

import { Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { cn } from "cn";

import { findStockItems, saveAdjustment } from "@/app/(app)/inventory-adjustments/actions";
import { Field } from "@/components/forms/save-form";
import { ItemPicker } from "@/components/invoices/item-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ADJUSTMENT_REASONS } from "@/lib/adjustments/validation";
import { formatQty } from "@/lib/format";
import type { StockItem } from "@/server/adjustments";

interface Line {
  key: string;
  item: StockItem;
  /** What the shelf holds now, as typed. */
  counted: string;
  /** How many to add (+) or take out (−), as typed. */
  change: string;
}

const num = (s: string) => {
  const n = Number(s.replace(/[,\s]/g, "").replace("−", "-"));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const show = (n: number) => String(round3(n));

let nextKey = 0;

export interface AdjustmentFormInitial {
  /** null for a new adjustment. */
  id: number | null;
  date: string;
  reason: string;
  notes: string;
  /** For an edit, each item's `stockQty` is the stock without this adjustment. */
  lines: { item: StockItem; qty: number }[];
}

/** Correct stock by hand: type what the shelf holds, or how many to add or take out. */
export function AdjustmentForm({ initial }: { initial: AdjustmentFormInitial }) {
  const editing = initial.id != null;
  const [date, setDate] = useState(initial.date);
  const [reason, setReason] = useState<string>(initial.reason);
  const [notes, setNotes] = useState(initial.notes);
  const [lines, setLines] = useState<Line[]>(() =>
    initial.lines.map((l) => ({
      key: `e${++nextKey}`,
      item: l.item,
      counted: show(l.item.stockQty + l.qty),
      change: show(l.qty),
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const pickerRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Line>) => {
    setError(null);
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addItem = (item: StockItem) => {
    setError(null);
    if (lines.some((l) => l.item.id === item.id)) return setError(`${item.description} is already in the list.`);
    setLines((ls) => [...ls, { key: `a${++nextKey}`, item, counted: "", change: "" }]);
  };

  const changes = lines.map((l) => num(l.change));
  const added = changes.reduce<number>((s, c) => s + (c != null && c > 0 ? c : 0), 0);
  const removed = changes.reduce<number>((s, c) => s + (c != null && c < 0 ? -c : 0), 0);

  const save = () => {
    setError(null);
    const bad = lines.findIndex((l) => {
      const c = num(l.change);
      return c == null || c === 0;
    });
    if (bad >= 0) return setError(`Item ${bad + 1}: enter the new count or how many to add or take out.`);
    const negative = lines.find((l) => round3(l.item.stockQty + (num(l.change) ?? 0)) < 0);
    if (negative) return setError(`${negative.item.description}: stock cannot go below 0.`);
    startSaving(async () => {
      const result = await saveAdjustment(initial.id, {
        date,
        reason,
        notes,
        lines: lines.map((l) => ({ productId: l.item.id, qty: round3(num(l.change) ?? 0) })),
      });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reason" htmlFor="a-reason">
          <Input
            id="a-reason"
            list="a-reasons"
            required
            maxLength={100}
            autoComplete="off"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-10"
          />
          <datalist id="a-reasons">
            {ADJUSTMENT_REASONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="Date" htmlFor="a-date">
          <Input id="a-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
        </Field>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Items</h2>
        {lines.length > 0 && (
          <ul className="flex flex-col divide-y rounded-xl border">
            {lines.map((l, i) => {
              const change = num(l.change);
              const after = change == null ? null : round3(l.item.stockQty + change);
              return (
                <li key={l.key} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        <span className="text-muted-foreground">{i + 1}. </span>
                        {l.item.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.item.partNo && <span className="font-mono">{l.item.partNo} · </span>}
                        {editing ? "Without this adjustment" : "In the app now"}: {formatQty(l.item.stockQty)}{" "}
                        {l.item.unit}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${l.item.description}`}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      New count on shelf
                      <Input
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder={formatQty(l.item.stockQty)}
                        value={l.counted}
                        onChange={(e) => {
                          const counted = num(e.target.value);
                          update(l.key, {
                            counted: e.target.value,
                            change: counted == null ? "" : show(counted - l.item.stockQty),
                          });
                        }}
                        className="text-right tabular-nums"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Add (+) or take out (−)
                      <Input
                        inputMode="text"
                        autoComplete="off"
                        placeholder="e.g. -2"
                        value={l.change}
                        onChange={(e) => {
                          const c = num(e.target.value);
                          update(l.key, {
                            change: e.target.value,
                            counted: c == null ? "" : show(l.item.stockQty + c),
                          });
                        }}
                        aria-invalid={(after != null && after < 0) || undefined}
                        className="text-right tabular-nums"
                      />
                    </label>
                  </div>
                  {change != null && change !== 0 && after != null && (
                    <p className={cn("text-right text-sm tabular-nums", after < 0 && "text-destructive")}>
                      <span className="text-muted-foreground">
                        {formatQty(l.item.stockQty)} {change > 0 ? "+" : "−"} {formatQty(Math.abs(change))} →{" "}
                      </span>
                      <span className="font-medium">
                        {formatQty(after)} {l.item.unit}
                      </span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <ItemPicker<StockItem> search={findStockItems} onPick={addItem} inputRef={pickerRef} />
      </section>

      <Field label="Notes (optional)" htmlFor="a-notes">
        <Textarea id="a-notes" maxLength={2000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mr-auto text-sm">
          <span className="text-muted-foreground">
            {lines.length} item{lines.length === 1 ? "" : "s"}
          </span>
          {(added > 0 || removed > 0) && (
            <span className="block text-xs text-muted-foreground tabular-nums">
              {[added > 0 && `+${formatQty(added)} in`, removed > 0 && `−${formatQty(removed)} out`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
        <Link
          href={editing ? `/inventory-adjustments/${initial.id}` : "/inventory-adjustments"}
          className={buttonVariants({ variant: "ghost" })}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={saving || lines.length === 0}>
          {saving ? "Saving…" : editing ? "Save changes" : "Save adjustment"}
        </Button>
        {error && (
          <p role="alert" className="basis-full text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

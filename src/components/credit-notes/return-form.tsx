"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "cn";

import { saveCreditNote } from "@/app/(app)/credit-notes/actions";
import { Field } from "@/components/forms/save-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RETURN_REASONS } from "@/lib/credit-notes/validation";
import { formatMoney, formatQty } from "@/lib/format";
import { calcInvoice } from "@/lib/invoices/math";
import type { Returnable } from "@/server/credit-notes";

const parseQty = (s: string) => {
  const n = Number(s.replace(/[,\s]/g, ""));
  return s.trim() === "" || !Number.isFinite(n) ? 0 : n;
};

/** Pick how many of each item came back; totals and tax follow the invoice. */
export function ReturnForm({ invoice, today }: { invoice: Returnable; today: string }) {
  const [qty, setQty] = useState<Record<number, string>>({});
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [refundType, setRefundType] = useState<"credit" | "cash">(
    invoice.customerId != null && invoice.paymentType === "credit" ? "credit" : "cash",
  );
  const [restock, setRestock] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const chosen = invoice.lines
    .map((l) => ({ ...l, back: parseQty(qty[l.id] ?? "") }))
    .filter((l) => l.back !== 0);
  const tooMany = chosen.find((l) => l.back < 0 || l.back > l.left);
  const { totals } = calcInvoice(
    chosen.map((l) => ({ qty: l.back, rate: l.rate, discountPct: l.discountPct, gstRate: l.gstRate })),
    invoice.taxType,
  );
  const nothingLeft = invoice.lines.every((l) => l.left === 0);

  const returnAll = () => setQty(Object.fromEntries(invoice.lines.map((l) => [l.id, l.left ? String(l.left) : ""])));

  const save = () => {
    setError(null);
    if (tooMany) {
      setError(`${tooMany.description}: you can return up to ${formatQty(tooMany.left)}.`);
      return;
    }
    startSaving(async () => {
      const result = await saveCreditNote({
        invoiceId: invoice.id,
        date,
        refundType,
        restock,
        reason,
        notes,
        lines: chosen.map((l) => ({ invoiceLineId: l.id, qty: l.back })),
      });
      if (result?.error) setError(result.error);
    });
  };

  if (nothingLeft) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Everything on this invoice has already been returned.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">How many came back?</h2>
          <Button type="button" variant="outline" size="xs" onClick={returnAll}>
            Return everything
          </Button>
        </div>
        <ul className="flex flex-col divide-y rounded-xl border">
          {invoice.lines.map((l) => {
            const back = parseQty(qty[l.id] ?? "");
            const bad = back < 0 || back > l.left;
            return (
              <li key={l.id} className={cn("flex items-center gap-3 px-4 py-3", l.left === 0 && "opacity-50")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.partNo && <span className="font-mono">{l.partNo} · </span>}
                    {formatMoney(l.rate)} · sold {formatQty(l.qty)}
                    {l.returned > 0 && <> · returned {formatQty(l.returned)}</>}
                  </p>
                </div>
                {l.left === 0 ? (
                  <span className="text-xs text-muted-foreground">all returned</span>
                ) : (
                  <div className="flex items-center gap-1">
                    <Input
                      aria-label={`Quantity returned of ${l.description}`}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      value={qty[l.id] ?? ""}
                      onChange={(e) => {
                        setError(null);
                        setQty((q) => ({ ...q, [l.id]: e.target.value }));
                      }}
                      aria-invalid={bad || undefined}
                      className="h-9 w-20 text-right tabular-nums"
                    />
                    <span className="w-14 text-xs text-muted-foreground">of {formatQty(l.left)}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="cn-date">
          <Input
            id="cn-date"
            type="date"
            required
            min={invoice.date}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10"
          />
        </Field>
        <Field label="Reason" htmlFor="cn-reason">
          <Input
            id="cn-reason"
            list="cn-reasons"
            required
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-10"
          />
          <datalist id="cn-reasons">
            {RETURN_REASONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
      </div>

      {invoice.customerId != null && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Money goes back as</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="refundType"
              checked={refundType === "credit"}
              onChange={() => setRefundType("credit")}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Credit to their account</span>
              <span className="block text-muted-foreground">Taken off what they owe.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="refundType"
              checked={refundType === "cash"}
              onChange={() => setRefundType("cash")}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Cash refund</span>
              <span className="block text-muted-foreground">You hand the money back now; their balance stays the same.</span>
            </span>
          </label>
        </fieldset>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="mt-0.5" />
        <span>
          <span className="font-medium">Put the parts back in stock</span>
          <span className="block text-muted-foreground">Untick for damaged parts that cannot be sold again.</span>
        </span>
      </label>

      <Field label="Notes (optional)" htmlFor="cn-notes">
        <Textarea id="cn-notes" maxLength={2000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mr-auto text-sm">
          <span className="text-muted-foreground">Credit note total </span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(totals.grandTotal)}</span>
          {chosen.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              Taxable {formatMoney(totals.taxableTotal)} + GST{" "}
              {formatMoney(totals.cgstTotal + totals.sgstTotal + totals.igstTotal)}
            </span>
          )}
        </div>
        <Link href={`/invoices/${invoice.id}`} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <Button type="submit" disabled={saving || chosen.length === 0}>
          {saving ? "Saving…" : "Save credit note"}
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

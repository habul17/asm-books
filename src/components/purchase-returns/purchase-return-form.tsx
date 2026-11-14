"use client";

import { Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import { findBillItems } from "@/app/(app)/bills/actions";
import { savePurchaseReturn } from "@/app/(app)/purchase-returns/actions";
import { Field } from "@/components/forms/save-form";
import { ItemPicker } from "@/components/invoices/item-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { VendorPicker } from "@/components/vendors/vendor-picker";
import { InfoTip } from "@/components/ui/info-tip";
import { formatMoney, formatQty } from "@/lib/format";
import { calcInvoice, taxTypeFor } from "@/lib/invoices/math";
import { PURCHASE_RETURN_REASONS } from "@/lib/purchase-returns/validation";
import { GST_RATES } from "@/lib/settings/business";
import type { PickedVendor } from "@/server/vendors";

type ReturnItem = Awaited<ReturnType<typeof findBillItems>>[number];

interface Line {
  key: string;
  productId: number;
  partNo: string | null;
  description: string;
  unit: string;
  stockQty: number;
  qty: string;
  rate: string;
  gstRate: number;
}

const num = (s: string) => {
  const n = Number(s.replace(/[,\s₹]/g, ""));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};

let nextKey = 0;

/** Send parts back to a vendor: stock goes out and what you owe them goes down. */
export function PurchaseReturnForm({
  today,
  vendor: initialVendor,
  sellerState,
}: {
  today: string;
  vendor: PickedVendor | null;
  sellerState: string | null;
}) {
  const [vendor, setVendor] = useState(initialVendor);
  const [date, setDate] = useState(today);
  const [billRef, setBillRef] = useState("");
  const [reason, setReason] = useState<string>(PURCHASE_RETURN_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const pickerRef = useRef<HTMLInputElement>(null);

  const taxType = taxTypeFor(sellerState, vendor?.stateCode || sellerState);
  const { lines: amounts, totals } = calcInvoice(
    lines.map((l) => ({ qty: num(l.qty) ?? 0, rate: num(l.rate) ?? 0, discountPct: 0, gstRate: l.gstRate })),
    taxType,
  );

  const update = (key: string, patch: Partial<Line>) => {
    setError(null);
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addItem = (item: ReturnItem) => {
    setError(null);
    if (lines.some((l) => l.productId === item.id)) return setError(`${item.description} is already in the list.`);
    setLines((ls) => [
      ...ls,
      {
        key: `r${++nextKey}`,
        productId: item.id,
        partNo: item.partNo,
        description: item.description,
        unit: item.unit,
        stockQty: item.stockQty,
        qty: "1",
        rate: item.price != null ? String(Math.round(item.price * 10000) / 10000) : "",
        gstRate: item.gstRate,
      },
    ]);
  };

  const save = () => {
    setError(null);
    if (!vendor) return setError("Choose the vendor you are sending the parts back to.");
    if (!lines.length) return setError("Add at least one item.");
    const bad = lines.findIndex((l) => num(l.qty) == null || num(l.rate) == null);
    if (bad >= 0) return setError(`Item ${bad + 1}: enter the quantity and rate.`);
    const short = lines.find((l) => (num(l.qty) ?? 0) > l.stockQty);
    if (short) return setError(`${short.description}: only ${formatQty(Math.max(short.stockQty, 0))} in stock.`);
    startSaving(async () => {
      const result = await savePurchaseReturn({
        vendorId: vendor.id,
        date,
        billRef,
        reason,
        notes,
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: num(l.qty) ?? 0,
          rate: num(l.rate) ?? 0,
          discountPct: 0,
          gstRate: l.gstRate,
        })),
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
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Send back to vendor</span>
        <VendorPicker value={vendor} onChange={setVendor} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Reason" htmlFor="pr-reason">
          <Input
            id="pr-reason"
            list="pr-reasons"
            required
            maxLength={100}
            autoComplete="off"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <datalist id="pr-reasons">
            {PURCHASE_RETURN_REASONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label="Date" htmlFor="pr-date">
          <Input id="pr-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Their bill no (optional)" htmlFor="pr-bill">
          <Input
            id="pr-bill"
            maxLength={50}
            autoComplete="off"
            value={billRef}
            onChange={(e) => setBillRef(e.target.value)}
            placeholder="Bill the parts came on"
          />
        </Field>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Items · {taxType === "inter" ? "IGST (other state)" : "CGST + SGST (same state)"}{" "}
          <InfoTip label="About the rate">
            The rate starts at the part&apos;s last purchase price. Change it to match what the vendor will credit.
          </InfoTip>
        </h2>
        {lines.length > 0 && (
          <ul className="flex flex-col divide-y rounded-xl border">
            {lines.map((l, i) => (
              <li key={l.key} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      <span className="text-muted-foreground">{i + 1}. </span>
                      {l.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.partNo && <span className="font-mono">{l.partNo} · </span>}
                      In stock: {formatQty(l.stockQty)} {l.unit}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${l.description}`}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Qty ({l.unit})
                    <Input
                      inputMode="decimal"
                      value={l.qty}
                      onChange={(e) => update(l.key, { qty: e.target.value })}
                      aria-invalid={(num(l.qty) ?? 0) > l.stockQty || undefined}
                      className="text-right tabular-nums"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Rate ₹ (before GST)
                    <Input
                      inputMode="decimal"
                      value={l.rate}
                      onChange={(e) => update(l.key, { rate: e.target.value })}
                      className="text-right tabular-nums"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    GST %
                    <NativeSelect
                      value={String(l.gstRate)}
                      onChange={(e) => update(l.key, { gstRate: Number(e.target.value) })}
                      className="w-full"
                    >
                      {GST_RATES.map((r) => (
                        <NativeSelectOption key={r} value={r}>
                          {r}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                </div>
                <p className="text-right text-sm tabular-nums">
                  <span className="text-muted-foreground">
                    {formatQty(num(l.qty) ?? 0)} × {l.rate || "0"} = {formatMoney(amounts[i]?.taxable ?? 0)} + GST →{" "}
                  </span>
                  <span className="font-medium">{formatMoney(amounts[i]?.total ?? 0)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
        <ItemPicker<ReturnItem> search={findBillItems} onPick={addItem} inputRef={pickerRef} />
      </section>

      <Field label="Notes (optional)" htmlFor="pr-notes">
        <Textarea id="pr-notes" maxLength={2000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mr-auto text-sm">
          <span className="text-muted-foreground">Return total </span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(totals.grandTotal)}</span>
          {lines.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              Taxable {formatMoney(totals.taxableTotal)} + GST{" "}
              {formatMoney(totals.cgstTotal + totals.sgstTotal + totals.igstTotal)}
              {totals.roundOff !== 0 && <> · round off {formatMoney(totals.roundOff)}</>}
            </span>
          )}
        </div>
        <Link href="/purchase-returns" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save return"}
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

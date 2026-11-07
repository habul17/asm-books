"use client";

import { Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import { findBillItems, saveBill } from "@/app/(app)/bills/actions";
import { Field } from "@/components/forms/save-form";
import { ItemPicker } from "@/components/invoices/item-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { VendorPicker } from "@/components/vendors/vendor-picker";
import { formatMoney, formatQty } from "@/lib/format";
import { calcInvoice, taxTypeFor } from "@/lib/invoices/math";
import { GST_RATES } from "@/lib/settings/business";
import type { PickedItem } from "@/server/invoices";
import type { PickedVendor } from "@/server/vendors";

export interface BillLineDraft {
  key: string;
  productId: number | null;
  partNo: string | null;
  description: string;
  unit: string;
  qty: string;
  rate: string;
  discountPct: string;
  gstRate: number;
}

export interface BillDraft {
  id: number | null;
  vendor: PickedVendor | null;
  billNo: string;
  date: string;
  dueDate: string;
  updatePrices: boolean;
  notes: string;
  lines: BillLineDraft[];
}

const num = (s: string) => {
  const n = Number(s.replace(/[,\s₹]/g, ""));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let nextKey = 0;
const newKey = () => `l${++nextKey}`;

/** Enter a vendor's bill: parts go into stock and, if ticked, their purchase prices update. */
export function BillEditor({
  initial,
  sellerState,
  cancelHref,
}: {
  initial: BillDraft;
  sellerState: string | null;
  cancelHref: string;
}) {
  const [vendor, setVendor] = useState(initial.vendor);
  const [billNo, setBillNo] = useState(initial.billNo);
  const [date, setDate] = useState(initial.date);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [updatePrices, setUpdatePrices] = useState(initial.updatePrices);
  const [notes, setNotes] = useState(initial.notes);
  const [lines, setLines] = useState(initial.lines);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const pickerRef = useRef<HTMLInputElement>(null);

  const taxType = taxTypeFor(sellerState, vendor?.stateCode || sellerState);
  const { lines: amounts, totals } = calcInvoice(
    lines.map((l) => ({
      qty: num(l.qty) ?? 0,
      rate: num(l.rate) ?? 0,
      discountPct: num(l.discountPct) ?? 0,
      gstRate: l.gstRate,
    })),
    taxType,
  );

  const chooseVendor = (v: PickedVendor | null) => {
    setVendor(v);
    // Fill the due date from the vendor's terms, unless the user already set one.
    if (v?.paymentTermsDays != null && !dueDate) setDueDate(addDays(date, v.paymentTermsDays));
  };

  const update = (key: string, patch: Partial<BillLineDraft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addItem = (item: PickedItem) => {
    setError(null);
    setLines((ls) => [
      ...ls,
      {
        key: newKey(),
        productId: item.id,
        partNo: item.partNo,
        description: item.description,
        unit: item.unit,
        qty: "1",
        rate: item.price != null ? String(Math.round(item.price * 10000) / 10000) : "",
        discountPct: "",
        gstRate: item.gstRate,
      },
    ]);
  };

  const save = () => {
    setError(null);
    if (!vendor) return setError("Choose a vendor");
    const bad = lines.findIndex((l) => num(l.qty) == null || num(l.rate) == null);
    if (bad >= 0) return setError(`Item ${bad + 1}: enter the quantity and rate`);
    startSaving(async () => {
      const result = await saveBill(initial.id, {
        vendorId: vendor.id,
        billNo,
        date,
        dueDate: dueDate || null,
        updatePrices,
        notes,
        lines: lines.map((l) => ({
          productId: l.productId,
          description: l.description,
          qty: num(l.qty) ?? 0,
          rate: num(l.rate) ?? 0,
          discountPct: num(l.discountPct) ?? 0,
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
        <span className="text-sm font-medium">Vendor</span>
        <VendorPicker value={vendor} onChange={chooseVendor} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Vendor's bill no" htmlFor="b-no">
          <Input
            id="b-no"
            required
            maxLength={50}
            autoComplete="off"
            value={billNo}
            onChange={(e) => setBillNo(e.target.value)}
            placeholder="As printed on their bill"
          />
        </Field>
        <Field label="Bill date" htmlFor="b-date">
          <Input id="b-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Due date (optional)" htmlFor="b-due">
          <Input id="b-due" type="date" min={date} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Items · {taxType === "inter" ? "IGST (other state)" : "CGST + SGST (same state)"}
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
                    {l.partNo && <p className="font-mono text-xs text-muted-foreground">{l.partNo}</p>}
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
                <div className="grid grid-cols-[1fr_1.4fr_1fr_1fr] gap-2">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Qty ({l.unit})
                    <Input
                      inputMode="decimal"
                      value={l.qty}
                      onChange={(e) => update(l.key, { qty: e.target.value })}
                      className="text-right tabular-nums"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Rate ₹
                    <Input
                      inputMode="decimal"
                      value={l.rate}
                      onChange={(e) => update(l.key, { rate: e.target.value })}
                      className="text-right tabular-nums"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Disc %
                    <Input
                      inputMode="decimal"
                      value={l.discountPct}
                      placeholder="0"
                      onChange={(e) => update(l.key, { discountPct: e.target.value })}
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
        <ItemPicker search={findBillItems} onPick={addItem} inputRef={pickerRef} />
        <p className="text-xs text-muted-foreground">The rate starts at the part&apos;s last purchase price; change it to match the bill.</p>
      </section>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={updatePrices}
          onChange={(e) => setUpdatePrices(e.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="font-medium">Update purchase prices</span>
          <span className="block text-muted-foreground">
            These rates (after discount, before GST) become the parts&apos; purchase prices, so your price lists follow
            them.
          </span>
        </span>
      </label>

      <Field label="Notes (optional)" htmlFor="b-notes">
        <Textarea id="b-notes" maxLength={2000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mr-auto text-sm">
          <span className="text-muted-foreground">Bill total </span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(totals.grandTotal)}</span>
          {lines.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              Taxable {formatMoney(totals.taxableTotal)} + GST{" "}
              {formatMoney(totals.cgstTotal + totals.sgstTotal + totals.igstTotal)}
              {totals.roundOff !== 0 && <> · round off {formatMoney(totals.roundOff)}</>}
            </span>
          )}
        </div>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <Button type="submit" disabled={saving || lines.length === 0}>
          {saving ? "Saving…" : initial.id == null ? "Save bill" : "Save changes"}
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

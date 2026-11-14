"use client";

import { CheckIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import { findBillItems, saveBill } from "@/app/(app)/bills/actions";
import { savePurchaseOrder } from "@/app/(app)/purchase-orders/actions";
import { Field } from "@/components/forms/save-form";
import { ItemPicker } from "@/components/invoices/item-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { VendorPicker } from "@/components/vendors/vendor-picker";
import { InfoTip } from "@/components/ui/info-tip";
import type { ScanFlag } from "@/lib/bills/scan";
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
  /** Things to check on a row that was filled in from a scanned bill. */
  flags?: ScanFlag[];
}

export interface BillDraft {
  id: number | null;
  vendor: PickedVendor | null;
  billNo: string;
  date: string;
  /** On a purchase order this is the date the parts are expected. */
  dueDate: string;
  /** The purchase order a new bill is for. */
  fromOrderId: number | null;
  updatePrices: boolean;
  roundTotal: boolean;
  notes: string;
  lines: BillLineDraft[];
}

const num = (s: string) => {
  const n = Number(s.replace(/[,\s₹]/g, ""));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let nextKey = 0;
const newKey = () => `l${++nextKey}`;

/**
 * Enter a vendor's bill: parts go into stock and, if ticked, their purchase prices update.
 * With `kind="order"` it writes a purchase order instead, which changes nothing in stock.
 */
export function BillEditor({
  initial,
  sellerState,
  cancelHref,
  printedTotal = null,
  kind = "bill",
}: {
  kind?: "bill" | "order";
  initial: BillDraft;
  sellerState: string | null;
  cancelHref: string;
  /** For a scanned bill: the total printed on the paper bill, to compare with the total worked out here. */
  printedTotal?: number | null;
}) {
  const [vendor, setVendor] = useState(initial.vendor);
  const [billNo, setBillNo] = useState(initial.billNo);
  const [date, setDate] = useState(initial.date);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [updatePrices, setUpdatePrices] = useState(initial.updatePrices);
  const [roundTotal, setRoundTotal] = useState(initial.roundTotal);
  const [notes, setNotes] = useState(initial.notes);
  const [lines, setLines] = useState(initial.lines);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const pickerRef = useRef<HTMLInputElement>(null);
  const isOrder = kind === "order";

  const taxType = taxTypeFor(sellerState, vendor?.stateCode || sellerState);
  const { lines: amounts, totals } = calcInvoice(
    lines.map((l) => ({
      qty: num(l.qty) ?? 0,
      rate: num(l.rate) ?? 0,
      discountPct: num(l.discountPct) ?? 0,
      gstRate: l.gstRate,
    })),
    taxType,
    { round: roundTotal },
  );

  const chooseVendor = (v: PickedVendor | null) => {
    setVendor(v);
    // Fill the due date from the vendor's terms, unless the user already set one.
    if (!isOrder && v?.paymentTermsDays != null && !dueDate) setDueDate(addDays(date, v.paymentTermsDays));
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

  /** Sets the part of a scanned row that could not be matched; the scanned qty and rate stay. */
  const choosePart = (key: string, item: PickedItem) =>
    setLines((ls) =>
      ls.map((l) =>
        l.key === key
          ? {
              ...l,
              productId: item.id,
              partNo: item.partNo,
              description: item.description,
              unit: item.unit,
              flags: l.flags?.filter((f) => f.kind !== "part"),
            }
          : l,
      ),
    );

  const totalGap = printedTotal == null ? null : Math.round((totals.grandTotal - printedTotal) * 100) / 100;

  const save = () => {
    setError(null);
    if (!vendor) return setError("Choose a vendor");
    // A scanned row without a part would not reach stock or prices.
    const noPart = lines.findIndex((l) => l.productId == null && l.flags?.some((f) => f.kind === "part"));
    if (noPart >= 0) return setError(`Item ${noPart + 1}: pick the part, or remove this row`);
    const bad = lines.findIndex((l) => num(l.qty) == null || num(l.rate) == null);
    if (bad >= 0) return setError(`Item ${bad + 1}: enter the quantity and rate`);
    const items = lines.map((l) => ({
      productId: l.productId,
      description: l.description,
      qty: num(l.qty) ?? 0,
      rate: num(l.rate) ?? 0,
      discountPct: num(l.discountPct) ?? 0,
      gstRate: l.gstRate,
    }));
    startSaving(async () => {
      const result = isOrder
        ? await savePurchaseOrder(initial.id, {
            vendorId: vendor.id,
            date,
            expectedDate: dueDate || null,
            notes,
            lines: items,
          })
        : await saveBill(initial.id, {
            vendorId: vendor.id,
            billNo,
            date,
            dueDate: dueDate || null,
            updatePrices,
            roundTotal,
            fromOrderId: initial.fromOrderId,
            notes,
            lines: items,
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

      <div className={isOrder ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-3"}>
        {!isOrder && (
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
        )}
        <Field label={isOrder ? "Order date" : "Bill date"} htmlFor="b-date">
          <Input id="b-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={isOrder ? "Expected by (optional)" : "Due date (optional)"} htmlFor="b-due">
          <Input id="b-due" type="date" min={date} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Items · {taxType === "inter" ? "IGST (other state)" : "CGST + SGST (same state)"}{" "}
          <InfoTip label="About the rate">
            {isOrder
              ? "The rate starts at the part's last purchase price. Change it if the vendor quoted another rate."
              : "The rate starts at the part's last purchase price. Change it to match the bill."}
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
                {l.flags && l.flags.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <ul className="flex flex-col gap-1">
                      {l.flags.map((f) => (
                        <li key={f.kind + f.text} className="flex items-start gap-1.5">
                          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                          <span>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                    {l.productId == null ? (
                      <LinePartPicker onPick={(item) => choosePart(l.key, item)} />
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        onClick={() => update(l.key, { flags: [] })}
                      >
                        <CheckIcon /> I checked this row
                      </Button>
                    )}
                  </div>
                )}
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
      </section>

      {!isOrder && (
        <>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={updatePrices}
          onChange={(e) => setUpdatePrices(e.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="font-medium">Update purchase prices</span>{" "}
          <InfoTip label="About Update purchase prices">
            These rates (after discount, before GST) become the parts&apos; purchase prices, so your price lists follow
            them.
          </InfoTip>
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={roundTotal}
          onChange={(e) => setRoundTotal(e.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="font-medium">Round total to whole rupees</span>{" "}
          <InfoTip label="About Round total">Untick when the supplier&apos;s bill keeps the paise, like ₹1,234.56.</InfoTip>
        </span>
      </label>
        </>
      )}

      <Field label="Notes (optional)" htmlFor="b-notes">
        <Textarea id="b-notes" maxLength={2000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mr-auto text-sm">
          <span className="text-muted-foreground">{isOrder ? "Order total " : "Bill total "}</span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(totals.grandTotal)}</span>
          {lines.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              Taxable {formatMoney(totals.taxableTotal)} + GST{" "}
              {formatMoney(totals.cgstTotal + totals.sgstTotal + totals.igstTotal)}
              {totals.roundOff !== 0 && <> · round off {formatMoney(totals.roundOff)}</>}
            </span>
          )}
          {totalGap != null && lines.length > 0 && (
            <span
              className={`block text-xs font-medium ${Math.abs(totalGap) <= 1 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}
            >
              {Math.abs(totalGap) <= 1
                ? `Matches the total printed on the bill (${formatMoney(printedTotal)})`
                : `The bill's printed total is ${formatMoney(printedTotal)}. This is ${formatMoney(Math.abs(totalGap))} ${totalGap > 0 ? "more" : "less"}. Check the rows.`}
            </span>
          )}
        </div>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <Button type="submit" disabled={saving || lines.length === 0}>
          {saving ? "Saving…" : initial.id != null ? "Save changes" : isOrder ? "Save purchase order" : "Save bill"}
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

/** Search box that sets the part of one scanned row. */
function LinePartPicker({ onPick }: { onPick: (item: PickedItem) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return <ItemPicker search={findBillItems} onPick={onPick} inputRef={ref} />;
}

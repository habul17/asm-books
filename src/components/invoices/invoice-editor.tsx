"use client";

import { PlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { repriceItems, saveInvoice } from "@/app/(app)/invoices/actions";
import { saveSalesDoc } from "@/app/(app)/sales/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_VALUE_MAX } from "@/lib/custom-fields";
import { formatMoney, formatQty } from "@/lib/format";
import { GST_STATES } from "@/lib/gst";
import { amountInWords, calcInvoice, taxTypeFor } from "@/lib/invoices/math";
import { CHALLAN_REASONS, SALES_DOC_KIND, salesDocHref, salesDocsHref, type SalesDocKind } from "@/lib/sales-docs/kinds";
import { GST_RATES } from "@/lib/settings/business";
import type { EditorOptions, PickedCustomer, PickedItem } from "@/server/invoices";

import { CustomerPicker } from "./customer-picker";
import { ItemPicker } from "./item-picker";

export interface EditorLine {
  key: string;
  productId: number | null;
  partNo: string | null;
  description: string;
  unit: string;
  qty: string;
  rate: string;
  discountPct: string;
  gstRate: number;
  /** Stock that can be sold on this invoice (for an edit, includes what it already sold). */
  available: number | null;
  /** Set once the user types a rate, so changing the price list does not overwrite it. */
  rateEdited: boolean;
}

export interface EditorInitial {
  id: number | null;
  date: string;
  mode: "customer" | "walk-in";
  customer: PickedCustomer | null;
  walkInName: string;
  walkInMobile: string;
  paymentType: "credit" | "cash";
  priceListId: number | null;
  /** State code picked for this sale; null follows the customer's state. */
  placeOfSupply: string | null;
  notes: string;
  /** Custom field values as text, keyed by field id. */
  extra: Record<string, string>;
  lines: EditorLine[];
  /** For an edit: the credit this invoice already adds to the customer's balance. */
  originalCredit: number;
  /** New invoice: the quote, order or challan it is made from. */
  fromDocId?: number | null;
  /** Quote: valid until. Order: deliver by. */
  secondDate?: string;
  /** Challan: why the goods move without an invoice. */
  reason?: string;
  /** New order or challan: the quote or order it is made from. */
  sourceId?: number | null;
}

const STATE_OPTIONS = Object.entries(GST_STATES).sort((a, b) => a[1].localeCompare(b[1]));

let keySeq = 0;
const newKey = () => `l${++keySeq}`;

/** Parses typed numbers; anything else counts as invalid. */
function num(text: string): number | null {
  const t = text.replace(/[₹,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function lineFromItem(item: PickedItem): EditorLine {
  return {
    key: newKey(),
    productId: item.id,
    partNo: item.partNo,
    description: item.description,
    unit: item.unit,
    qty: "1",
    rate: item.price != null ? String(item.price) : "",
    discountPct: "",
    gstRate: item.gstRate,
    available: item.stockQty,
    rateEdited: false,
  };
}

/**
 * The form for an invoice. Quotes, sales orders and delivery challans use it
 * too (`kind`): they have no payment, and a second date or a reason instead.
 */
export function InvoiceEditor({
  initial,
  options,
  kind = "invoice",
}: {
  initial: EditorInitial;
  options: EditorOptions;
  kind?: "invoice" | SalesDocKind;
}) {
  const doc = kind === "invoice" ? null : SALES_DOC_KIND[kind];
  const noun = doc?.noun ?? "invoice";
  const [date, setDate] = useState(initial.date);
  const [secondDate, setSecondDate] = useState(initial.secondDate ?? "");
  const [reason, setReason] = useState(initial.reason ?? "");
  const [mode, setMode] = useState(initial.mode);
  const [customer, setCustomer] = useState(initial.customer);
  const [walkInName, setWalkInName] = useState(initial.walkInName);
  const [walkInMobile, setWalkInMobile] = useState(initial.walkInMobile);
  const [paymentType, setPaymentType] = useState(initial.paymentType);
  const [priceListId, setPriceListId] = useState(initial.priceListId);
  // null follows the customer's state; "" is a sale to another state whose state is not chosen yet.
  const [supply, setSupply] = useState(initial.placeOfSupply);
  const [notes, setNotes] = useState(initial.notes);
  const [extra, setExtra] = useState(initial.extra);
  const [lines, setLines] = useState(initial.lines);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [repricing, setRepricing] = useState(false);
  const itemSearchRef = useRef<HTMLInputElement>(null);

  const touch = () => setDirty(true);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const isWalkIn = mode === "walk-in";
  // An old walk-in invoice can still be edited after walk-ins are switched off.
  // A quote is often for someone who is not a customer yet, so documents always allow a typed name.
  const walkInAllowed = doc != null || options.allowWalkIn || initial.mode === "walk-in";
  const effectivePayment = isWalkIn ? "cash" : paymentType;
  const customerState = (!isWalkIn && customer?.stateCode) || options.sellerState;
  const placeOfSupply = supply ?? customerState;
  const taxType = supply === "" ? "inter" : taxTypeFor(options.sellerState, placeOfSupply);
  const chooseTaxType = (type: "intra" | "inter") => {
    if (type === taxType) return;
    touch();
    const customerIsOutside = taxTypeFor(options.sellerState, customerState) === "inter";
    if (type === "intra") setSupply(customerIsOutside ? options.sellerState : null);
    else setSupply(customerIsOutside ? null : "");
  };

  const calc = useMemo(() => {
    const parsed = lines.map((l) => ({
      qty: num(l.qty) ?? 0,
      rate: num(l.rate) ?? 0,
      discountPct: num(l.discountPct) ?? 0,
      gstRate: l.gstRate,
    }));
    return calcInvoice(parsed, taxType);
  }, [lines, taxType]);

  const creditAfter =
    !doc && !isWalkIn && customer && effectivePayment === "credit"
      ? customer.balance - initial.originalCredit * (customer.id === initial.customer?.id ? 1 : 0) + calc.totals.grandTotal
      : null;
  const overLimit = creditAfter != null && customer?.creditLimit != null && creditAfter > customer.creditLimit;

  const updateLine = (key: string, patch: Partial<EditorLine>) => {
    touch();
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addItem = (item: PickedItem) => {
    touch();
    setLines((ls) => {
      const same = ls.find((l) => l.productId === item.id);
      if (same) {
        const qty = (num(same.qty) ?? 0) + 1;
        return ls.map((l) => (l.key === same.key ? { ...l, qty: formatQty(qty) } : l));
      }
      return [...ls, lineFromItem(item)];
    });
  };

  const addBlankLine = () => {
    touch();
    setLines((ls) => [
      ...ls,
      {
        key: newKey(),
        productId: null,
        partNo: null,
        description: "",
        unit: "Nos",
        qty: "1",
        rate: "",
        discountPct: "",
        gstRate: options.defaultGstRate,
        available: null,
        rateEdited: true,
      },
    ]);
  };

  /** New price list: update rates the user has not typed by hand. */
  const changePriceList = async (listId: number | null) => {
    touch();
    setPriceListId(listId);
    const ids = lines.filter((l) => l.productId != null && !l.rateEdited).map((l) => l.productId as number);
    if (!ids.length) return;
    setRepricing(true);
    try {
      const prices = new Map((await repriceItems(ids, listId)).map((p) => [p.id, p.price]));
      setLines((ls) =>
        ls.map((l) => {
          if (l.productId == null || l.rateEdited || !prices.has(l.productId)) return l;
          const price = prices.get(l.productId);
          return { ...l, rate: price != null ? String(price) : "" };
        }),
      );
    } finally {
      setRepricing(false);
    }
  };

  const chooseCustomer = (c: PickedCustomer | null) => {
    touch();
    setCustomer(c);
    setSupply(null);
    if (c) {
      setPaymentType("credit");
      const listId = c.priceListId ?? options.defaultPriceListId;
      if (listId !== priceListId) void changePriceList(listId);
    }
  };

  const save = () => {
    setError(null);
    if (!isWalkIn && !customer) {
      setError(walkInAllowed ? "Choose a customer, or switch to walk-in." : "Choose a customer.");
      return;
    }
    if (doc && isWalkIn && !walkInName.trim()) {
      setError("Type the customer's name.");
      return;
    }
    if (supply === "") {
      setError("Choose the state you are selling to.");
      return;
    }
    for (const [i, l] of lines.entries()) {
      if (num(l.qty) == null || num(l.rate) == null || (l.discountPct.trim() !== "" && num(l.discountPct) == null)) {
        setError(`Item ${i + 1}: enter a valid quantity, rate and discount.`);
        return;
      }
    }
    const payload = {
      date,
      customerId: isWalkIn ? null : (customer?.id ?? null),
      walkInName: isWalkIn ? walkInName : "",
      walkInMobile: isWalkIn ? walkInMobile : "",
      priceListId,
      placeOfSupply: supply,
      notes,
      lines: lines.map((l) => ({
        productId: l.productId,
        description: l.description,
        qty: num(l.qty) ?? 0,
        rate: num(l.rate) ?? 0,
        discountPct: num(l.discountPct) ?? 0,
        gstRate: l.gstRate,
      })),
    };
    startSaving(async () => {
      const result =
        kind === "invoice"
          ? await saveInvoice(initial.id, {
              ...payload,
              paymentType: effectivePayment,
              extra,
              fromDocId: initial.fromDocId ?? null,
            })
          : await saveSalesDoc(kind, initial.id, {
              ...payload,
              secondDate: secondDate || null,
              reason,
              sourceId: initial.sourceId ?? null,
            });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {!options.businessReady && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlertIcon className="size-4 shrink-0" />
          <span>
            Your business details are empty, so invoices will print without them.{" "}
            <Link href="/settings" className="font-medium underline underline-offset-4">
              Fill them in Settings
            </Link>
          </span>
        </p>
      )}

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Bill to</Label>
              {walkInAllowed && (
              <div className="flex rounded-lg bg-muted p-0.5 text-sm" role="radiogroup" aria-label="Customer type">
                {(["customer", "walk-in"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => {
                      touch();
                      setMode(m);
                      setSupply(null);
                    }}
                    className={`rounded-md px-2.5 py-1 ${mode === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
                  >
                    {m === "customer" ? "Customer" : doc ? "New name" : "Walk-in (cash)"}
                  </button>
                ))}
              </div>
              )}
            </div>
            {isWalkIn ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label="Walk-in name"
                  placeholder={doc ? "Customer name" : "Name (optional)"}
                  value={walkInName}
                  maxLength={200}
                  onChange={(e) => {
                    touch();
                    setWalkInName(e.target.value);
                  }}
                />
                <Input
                  aria-label="Walk-in mobile"
                  placeholder="Mobile (optional)"
                  type="tel"
                  inputMode="tel"
                  value={walkInMobile}
                  maxLength={40}
                  onChange={(e) => {
                    touch();
                    setWalkInMobile(e.target.value);
                  }}
                />
              </div>
            ) : (
              <CustomerPicker value={customer} onChange={chooseCustomer} />
            )}
            {overLimit && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <TriangleAlertIcon className="size-4" /> Over credit limit: balance would be{" "}
                {formatMoney(creditAfter)} (limit {formatMoney(customer?.creditLimit)})
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-date">Date</Label>
              <Input
                id="inv-date"
                type="date"
                value={date}
                required
                onChange={(e) => {
                  touch();
                  setDate(e.target.value);
                }}
              />
            </div>
            {!doc && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-pay">Payment</Label>
                <NativeSelect
                  id="inv-pay"
                  className="w-full"
                  value={effectivePayment}
                  disabled={isWalkIn}
                  onChange={(e) => {
                    touch();
                    setPaymentType(e.target.value === "cash" ? "cash" : "credit");
                  }}
                >
                  <NativeSelectOption value="credit">Credit</NativeSelectOption>
                  <NativeSelectOption value="cash">Cash / paid now</NativeSelectOption>
                </NativeSelect>
              </div>
            )}
            {doc?.secondDateLabel && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-date2">{doc.secondDateLabel}</Label>
                <Input
                  id="inv-date2"
                  type="date"
                  value={secondDate}
                  min={date}
                  onChange={(e) => {
                    touch();
                    setSecondDate(e.target.value);
                  }}
                />
              </div>
            )}
            {kind === "challan" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inv-reason">Reason</Label>
                <Input
                  id="inv-reason"
                  list="inv-reasons"
                  value={reason}
                  maxLength={200}
                  placeholder="Why the goods are sent"
                  onChange={(e) => {
                    touch();
                    setReason(e.target.value);
                  }}
                />
                <datalist id="inv-reasons">
                  {CHALLAN_REASONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
            )}
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label id="inv-tax-label">GST</Label>
              <div
                className="grid grid-cols-2 rounded-lg bg-muted p-0.5 text-sm"
                role="radiogroup"
                aria-labelledby="inv-tax-label"
              >
                {(["intra", "inter"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={taxType === t}
                    disabled={!options.sellerState}
                    onClick={() => chooseTaxType(t)}
                    className={`rounded-md px-2.5 py-1 disabled:opacity-60 ${taxType === t ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
                  >
                    <span className="block">{t === "intra" ? "Within state" : "Other state"}</span>
                    <span className="block text-xs text-muted-foreground">{t === "intra" ? "CGST + SGST" : "IGST"}</span>
                  </button>
                ))}
              </div>
              {!options.sellerState && (
                <p className="text-xs text-muted-foreground">
                  To bill another state, first set your own state in{" "}
                  <Link href="/settings" className="underline underline-offset-4">
                    Settings
                  </Link>
                  .
                </p>
              )}
              {taxType === "inter" && (
                <NativeSelect
                  aria-label="State you are selling to"
                  className="w-full"
                  value={placeOfSupply ?? ""}
                  onChange={(e) => {
                    touch();
                    setSupply(e.target.value);
                  }}
                >
                  <NativeSelectOption value="">Choose the state</NativeSelectOption>
                  {STATE_OPTIONS.filter(([code]) => code !== options.sellerState).map(([code, name]) => (
                    <NativeSelectOption key={code} value={code}>
                      {name} ({code})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="inv-list">Price list</Label>
              <NativeSelect
                id="inv-list"
                className="w-full"
                value={priceListId ?? ""}
                disabled={repricing}
                onChange={(e) => void changePriceList(e.target.value ? Number(e.target.value) : null)}
              >
                <NativeSelectOption value="">— No price list (list price) —</NativeSelectOption>
                {options.priceLists.map((l) => (
                  <NativeSelectOption key={l.id} value={l.id}>
                    {l.name}
                    {l.enabled ? "" : " (off)"}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </CardContent>
      </Card>

      {options.fields.length > 0 && (
        <Card>
          <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {options.fields.map((f) => (
              <div key={f.id} className="flex flex-col gap-1.5">
                <Label htmlFor={`inv-extra-${f.id}`}>{f.label}</Label>
                <Input
                  id={`inv-extra-${f.id}`}
                  type={f.type === "date" ? "date" : "text"}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  value={extra[String(f.id)] ?? ""}
                  maxLength={FIELD_VALUE_MAX}
                  onChange={(e) => {
                    touch();
                    setExtra((x) => ({ ...x, [String(f.id)]: e.target.value }));
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3">
          <ItemPicker priceListId={priceListId} onPick={addItem} inputRef={itemSearchRef} />

          <div className="hidden border-b pb-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_5rem_6.5rem_4.5rem_5.5rem_7rem_2.25rem] md:gap-2">
            <span>Item</span>
            <span>Qty</span>
            <span>Rate ₹</span>
            <span>Disc %</span>
            <span>GST</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          {lines.some((l) => l.rate.trim() === "") && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Some parts have no price{priceListId == null ? " because no price list is chosen" : " in this price list"}.
              Type the price, or choose a price list above.
            </p>
          )}
          {lines.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Search above to add parts to this {noun}.
            </p>
          ) : (
            <ol className="flex flex-col">
              {lines.map((l, i) => {
                const qty = num(l.qty);
                const short = l.available != null && qty != null && qty > l.available;
                const amount = calc.lines[i]?.total ?? 0;
                return (
                  <li
                    key={l.key}
                    className="grid grid-cols-4 items-end gap-2 border-b py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_5rem_6.5rem_4.5rem_5.5rem_7rem_2.25rem] md:items-center md:py-2"
                  >
                    <div className="col-span-3 flex min-w-0 flex-col gap-1 md:col-span-1">
                      <Input
                        aria-label={`Item ${i + 1} description`}
                        value={l.description}
                        maxLength={300}
                        placeholder="Item description"
                        onChange={(e) => updateLine(l.key, { description: e.target.value })}
                      />
                      <span className="truncate text-xs text-muted-foreground">
                        {i + 1}. {l.partNo ? <span className="font-mono">{l.partNo}</span> : "Custom item"}
                        {l.available != null && (
                          <span className={short ? "font-medium text-destructive" : undefined}>
                            {" "}
                            · stock {formatQty(l.available)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-end md:order-last">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove item ${i + 1}`}
                        onClick={() => {
                          touch();
                          setLines((ls) => ls.filter((x) => x.key !== l.key));
                        }}
                      >
                        <XIcon />
                      </Button>
                    </div>
                    <LineNumber
                      label="Qty"
                      value={l.qty}
                      invalid={qty == null || qty <= 0}
                      onChange={(v) => updateLine(l.key, { qty: v })}
                    />
                    <LineNumber
                      label="Rate ₹"
                      value={l.rate}
                      placeholder="Enter price"
                      invalid={num(l.rate) == null}
                      onChange={(v) => updateLine(l.key, { rate: v, rateEdited: true })}
                    />
                    <LineNumber
                      label="Disc %"
                      value={l.discountPct}
                      placeholder="0"
                      invalid={l.discountPct.trim() !== "" && num(l.discountPct) == null}
                      onChange={(v) => updateLine(l.key, { discountPct: v })}
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground md:sr-only">GST</span>
                      <NativeSelect
                        aria-label={`Item ${i + 1} GST`}
                        className="w-full"
                        value={String(l.gstRate)}
                        onChange={(e) => updateLine(l.key, { gstRate: Number(e.target.value) })}
                      >
                        {GST_RATES.map((r) => (
                          <NativeSelectOption key={r} value={r}>
                            {r}%
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                    <span className="col-span-4 text-right text-sm font-medium tabular-nums md:col-span-1">
                      {formatMoney(amount)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addBlankLine}>
            <PlusIcon /> Item without part number
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-1.5">
            <Label htmlFor="inv-notes">Notes (printed on the {noun})</Label>
            <Textarea
              id="inv-notes"
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => {
                touch();
                setNotes(e.target.value);
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <dl className="flex flex-col gap-1 text-sm">
              <TotalRow label="Taxable value" value={calc.totals.taxableTotal} />
              {taxType === "inter" ? (
                <TotalRow label="IGST" value={calc.totals.igstTotal} />
              ) : (
                <>
                  <TotalRow label="CGST" value={calc.totals.cgstTotal} />
                  <TotalRow label="SGST" value={calc.totals.sgstTotal} />
                </>
              )}
              <TotalRow label="Round off" value={calc.totals.roundOff} />
              <div className="mt-1 flex items-baseline justify-between border-t pt-2">
                <dt className="font-medium">Total</dt>
                <dd className="text-xl font-semibold tabular-nums">{formatMoney(calc.totals.grandTotal)}</dd>
              </div>
              <p className="text-xs text-muted-foreground">{amountInWords(calc.totals.grandTotal)}</p>
              <p className="text-xs text-muted-foreground">
                {taxType === "inter" ? "IGST: sale to another state" : "CGST + SGST: sale within the state"}
                {placeOfSupply && GST_STATES[placeOfSupply] ? ` · Place of supply: ${GST_STATES[placeOfSupply]}` : ""}
              </p>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <Button type="button" onClick={save} disabled={saving || lines.length === 0}>
          {saving ? "Saving…" : initial.id ? "Save changes" : `Save ${noun}`}
        </Button>
        <Link
          href={
            kind === "invoice"
              ? initial.id
                ? `/invoices/${initial.id}`
                : "/invoices"
              : initial.id
                ? salesDocHref(kind, initial.id)
                : salesDocsHref(kind)
          }
          className={buttonVariants({ variant: "ghost" })}
        >
          Cancel
        </Link>
        <span aria-live="polite" className="text-sm text-destructive">
          {error}
        </span>
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {lines.length} item{lines.length === 1 ? "" : "s"} · {formatMoney(calc.totals.grandTotal)}
        </span>
      </div>
    </div>
  );
}

function LineNumber({
  label,
  value,
  invalid,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  invalid: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground md:sr-only">{label}</span>
      <Input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        className="text-right tabular-nums"
      />
    </label>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}

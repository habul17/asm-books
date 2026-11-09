"use client";

import Link from "next/link";
import { useState } from "react";

import { saveExpense } from "@/app/(app)/expenses/actions";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_MODE_LABELS, PAYMENT_MODES, type PaymentMode } from "@/lib/payments/validation";
import { GST_RATES } from "@/lib/settings/business";

export interface ExpenseFormValues {
  date: string;
  category: string;
  paidTo: string;
  vendorId: number | null;
  amount: number | null;
  gstRate: number;
  mode: PaymentMode;
  reference: string;
  notes: string;
}

export function ExpenseForm({
  id,
  initial,
  categories,
  vendors,
  backHref,
}: {
  /** null for a new expense. */
  id: number | null;
  initial: ExpenseFormValues;
  /** Suggestions for the category box. */
  categories: string[];
  /** Saved suppliers to pick for "Paid to". */
  vendors: { id: number; name: string }[];
  backHref: string;
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveExpense.bind(null, id));
  const [vendorId, setVendorId] = useState(initial.vendorId == null ? "" : String(initial.vendorId));

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="e-category">
          <Input
            id="e-category"
            name="category"
            list="e-categories"
            required
            maxLength={60}
            autoComplete="off"
            defaultValue={initial.category}
            placeholder="Rent, Salary, Freight…"
            className="h-10"
          />
          <datalist id="e-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Amount (₹)" htmlFor="e-amount">
          <Input
            id="e-amount"
            name="amount"
            inputMode="decimal"
            required
            autoComplete="off"
            defaultValue={initial.amount == null ? "" : String(initial.amount)}
            placeholder="0.00"
            className="h-10 text-lg font-medium tabular-nums"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="e-date">
          <Input id="e-date" name="date" type="date" required defaultValue={initial.date} className="h-10" />
        </Field>
        <Field label="Paid to" htmlFor="e-vendor">
          <NativeSelect
            id="e-vendor"
            name="vendorId"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">— Someone else (type the name) —</NativeSelectOption>
            {vendors.map((v) => (
              <NativeSelectOption key={v.id} value={v.id}>
                {v.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {vendorId === "" && (
            <Input
              id="e-paid-to"
              name="paidTo"
              aria-label="Name of who was paid (optional)"
              maxLength={100}
              autoComplete="off"
              defaultValue={initial.vendorId == null ? initial.paidTo : ""}
              placeholder="Landlord, staff name… (optional)"
              className="mt-2"
            />
          )}
        </Field>
      </div>

      <Field label="GST in this amount" htmlFor="e-gst" hint="Choose the rate if the bill shows GST you can claim back.">
        <NativeSelect id="e-gst" name="gstRate" defaultValue={String(initial.gstRate)} className="w-full sm:w-1/2">
          <NativeSelectOption value="0">No GST</NativeSelectOption>
          {GST_RATES.filter((r) => r > 0).map((r) => (
            <NativeSelectOption key={r} value={r}>
              Includes {r}% GST
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paid by" htmlFor="e-mode">
          <NativeSelect id="e-mode" name="mode" defaultValue={initial.mode} className="w-full">
            {PAYMENT_MODES.map((m) => (
              <NativeSelectOption key={m} value={m}>
                {PAYMENT_MODE_LABELS[m]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Reference (optional)" htmlFor="e-ref">
          <Input
            id="e-ref"
            name="reference"
            defaultValue={initial.reference}
            maxLength={100}
            autoComplete="off"
            placeholder="Receipt no, UPI ref…"
          />
        </Field>
      </div>

      <Field label="Notes (optional)" htmlFor="e-notes">
        <Textarea id="e-notes" name="notes" defaultValue={initial.notes} maxLength={1000} rows={2} />
      </Field>

      <SaveRow state={state} pending={pending} dirty={dirty} label={id == null ? "Save expense" : "Save changes"}>
        <Link href={backHref} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </SaveRow>
    </form>
  );
}

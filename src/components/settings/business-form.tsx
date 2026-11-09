"use client";

import { useState } from "react";

import { saveBusiness } from "@/app/(app)/settings/actions";
import { GstinHint } from "@/components/forms/gstin-hint";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { checkGstin, GST_STATE_OPTIONS } from "@/lib/gst";
import { GST_RATES, type BusinessSettings } from "@/lib/settings/business";

export function BusinessForm({
  business: b,
  priceLists,
  canEdit,
}: {
  business: BusinessSettings;
  priceLists: { id: number; name: string; enabled: boolean }[];
  canEdit: boolean;
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveBusiness);
  const [gstin, setGstin] = useState(b.gstin);
  const gstinState = gstin.trim() ? checkGstin(gstin) : null;

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-6" noValidate>
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Business</legend>
        <Field label="Business name *" htmlFor="b-name" className="sm:col-span-2">
          <Input id="b-name" name="name" defaultValue={b.name} required maxLength={200} />
        </Field>
        <Field label="Address" htmlFor="b-address" className="sm:col-span-2">
          <Textarea id="b-address" name="address" rows={2} defaultValue={b.address} maxLength={1000} />
        </Field>
        <Field label="City" htmlFor="b-city">
          <Input id="b-city" name="city" defaultValue={b.city} maxLength={100} />
        </Field>
        <Field label="PIN code" htmlFor="b-pin">
          <Input id="b-pin" name="pincode" inputMode="numeric" defaultValue={b.pincode} maxLength={7} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <Field label="GSTIN" htmlFor="b-gstin">
            <Input
              id="b-gstin"
              name="gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              maxLength={20}
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono uppercase"
            />
          </Field>
          <GstinHint value={gstin} emptyText="Needed for tax invoices." />
        </div>
        <Field
          label="State"
          htmlFor="b-state"
          hint={gstinState?.ok ? "Taken from the GSTIN" : "Decides CGST + SGST or IGST on invoices."}
        >
          <NativeSelect
            id="b-state"
            name="stateCode"
            className="w-full"
            {...(gstinState?.ok ? { value: gstinState.stateCode, disabled: true } : { defaultValue: b.stateCode })}
          >
            <NativeSelectOption value="">—</NativeSelectOption>
            {GST_STATE_OPTIONS.map((s) => (
              <NativeSelectOption key={s.code} value={s.code}>
                {s.name} ({s.code})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Phone" htmlFor="b-phone">
          <Input id="b-phone" name="phone" type="tel" defaultValue={b.phone} maxLength={100} />
        </Field>
        <Field label="Email" htmlFor="b-email">
          <Input id="b-email" name="email" type="email" defaultValue={b.email} maxLength={200} />
        </Field>
      </fieldset>

      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Invoices</legend>
        <Field label="Invoice number prefix" htmlFor="b-prefix" hint="INV gives INV/26-27/0001">
          <Input
            id="b-prefix"
            name="invoicePrefix"
            defaultValue={b.invoicePrefix}
            maxLength={6}
            autoCapitalize="characters"
            className="uppercase"
          />
        </Field>
        <Field label="Receipt prefix" htmlFor="b-rprefix" hint="For payments received: RCPT gives RCPT/26-27/0001">
          <Input
            id="b-rprefix"
            name="receiptPrefix"
            defaultValue={b.receiptPrefix}
            maxLength={6}
            autoCapitalize="characters"
            className="uppercase"
          />
        </Field>
        <Field label="Credit note prefix" htmlFor="b-cprefix" hint="For returns: CN gives CN/26-27/0001">
          <Input
            id="b-cprefix"
            name="creditNotePrefix"
            defaultValue={b.creditNotePrefix}
            maxLength={6}
            autoCapitalize="characters"
            className="uppercase"
          />
        </Field>
        <Field label="Payment made prefix" htmlFor="b-pprefix" hint="For payments to vendors: PAY gives PAY/26-27/0001">
          <Input
            id="b-pprefix"
            name="vendorPaymentPrefix"
            defaultValue={b.vendorPaymentPrefix}
            maxLength={6}
            autoCapitalize="characters"
            className="uppercase"
          />
        </Field>
        <Field label="Expense prefix" htmlFor="b-eprefix" hint="For expenses: EXP gives EXP/26-27/0001">
          <Input
            id="b-eprefix"
            name="expensePrefix"
            defaultValue={b.expensePrefix}
            maxLength={6}
            autoCapitalize="characters"
            className="uppercase"
          />
        </Field>
        <Field label="Adjustment prefix" htmlFor="b-aprefix" hint="For stock adjustments: ADJ gives ADJ/26-27/0001">
          <Input
            id="b-aprefix"
            name="adjustmentPrefix"
            defaultValue={b.adjustmentPrefix}
            maxLength={6}
            autoCapitalize="characters"
            className="uppercase"
          />
        </Field>
        <Field label="Debit note prefix" htmlFor="b-dprefix" hint="For purchase returns: DN gives DN/26-27/0001">
          <Input
            id="b-dprefix"
            name="debitNotePrefix"
            defaultValue={b.debitNotePrefix}
            maxLength={6}
            autoCapitalize="characters"
            className="uppercase"
          />
        </Field>
        <Field label="Invoice title" htmlFor="b-title">
          <Input id="b-title" name="invoiceTitle" defaultValue={b.invoiceTitle} maxLength={60} />
        </Field>
        <Field label="Default GST %" htmlFor="b-gst" hint="For products without their own GST rate.">
          <NativeSelect id="b-gst" name="defaultGstRate" defaultValue={String(b.defaultGstRate)} className="w-full">
            {GST_RATES.map((r) => (
              <NativeSelectOption key={r} value={r}>
                {r}%
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Default price list"
          htmlFor="b-list"
          hint="Prices walk-in sales and customers without their own price list."
        >
          <NativeSelect id="b-list" name="defaultPriceListId" defaultValue={b.defaultPriceListId ?? ""} className="w-full">
            <NativeSelectOption value="">— None (type prices by hand) —</NativeSelectOption>
            {priceLists.map((l) => (
              <NativeSelectOption key={l.id} value={l.id}>
                {l.name}
                {l.enabled ? "" : " (off)"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Terms printed on invoices" htmlFor="b-terms" className="sm:col-span-2">
          <Textarea
            id="b-terms"
            name="terms"
            rows={3}
            defaultValue={b.terms}
            maxLength={3000}
            placeholder="e.g. Goods once sold will not be taken back."
          />
        </Field>
      </fieldset>

      <fieldset disabled={!canEdit} className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Sales rules</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="allowWalkIn" defaultChecked={b.allowWalkIn} className="mt-0.5 size-4 accent-primary" />
          <span>
            Allow walk-in sales
            <span className="block text-muted-foreground">When off, every invoice must be for a saved customer.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="allowShortStock"
            defaultChecked={b.allowShortStock}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            Allow selling more than the stock in hand
            <span className="block text-muted-foreground">
              When off, an invoice is stopped if a part does not have enough stock. Turn on for a while if your stock
              is not entered yet.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Bank and UPI (printed for payment)</legend>
        <Field label="Bank name" htmlFor="b-bank">
          <Input id="b-bank" name="bankName" defaultValue={b.bankName} maxLength={100} />
        </Field>
        <Field label="Account number" htmlFor="b-acc">
          <Input id="b-acc" name="bankAccount" inputMode="numeric" defaultValue={b.bankAccount} maxLength={24} />
        </Field>
        <Field label="IFSC" htmlFor="b-ifsc">
          <Input id="b-ifsc" name="bankIfsc" defaultValue={b.bankIfsc} maxLength={11} className="uppercase" />
        </Field>
        <Field label="UPI ID" htmlFor="b-upi">
          <Input id="b-upi" name="upiId" defaultValue={b.upiId} maxLength={300} placeholder="name@bank" />
        </Field>
      </fieldset>

      {canEdit ? (
        <SaveRow state={state} pending={pending} dirty={dirty} />
      ) : (
        <p className="text-sm text-muted-foreground">Only the owner can change these details.</p>
      )}
    </form>
  );
}

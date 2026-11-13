"use client";

import { useMemo, useState, type ReactNode } from "react";

import { saveBusinessSection } from "@/app/(app)/business/actions";
import { GstinHint } from "@/components/forms/gstin-hint";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { checkGstin, GST_STATE_OPTIONS } from "@/lib/gst";
import { GST_RATES, type BusinessSection, type BusinessSettings } from "@/lib/settings/business";

/** One part of the business settings with its own Save button. */
function SectionForm({ section, children }: { section: BusinessSection; children: ReactNode }) {
  const action = useMemo(() => saveBusinessSection.bind(null, section), [section]);
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(action);
  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5" noValidate>
      {children}
      <SaveRow state={state} pending={pending} dirty={dirty} />
    </form>
  );
}

const grid = "grid gap-4 sm:grid-cols-2";

export function ShopForm({ b }: { b: BusinessSettings }) {
  const [gstin, setGstin] = useState(b.gstin);
  const gstinState = gstin.trim() ? checkGstin(gstin) : null;
  return (
    <SectionForm section="shop">
      <div className={grid}>
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
      </div>
    </SectionForm>
  );
}

function Tick({ name, checked, title, note }: { name: string; checked: boolean; title: string; note: string }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 size-4 accent-primary" />
      <span>
        <span className="font-medium">{title}</span>
        <span className="block text-muted-foreground">{note}</span>
      </span>
    </label>
  );
}

export function BillsForm({
  b,
  priceLists,
}: {
  b: BusinessSettings;
  priceLists: { id: number; name: string; enabled: boolean }[];
}) {
  return (
    <SectionForm section="bills">
      <div className={grid}>
        <Field label="Invoice title" htmlFor="b-title" hint="Printed at the top of every invoice.">
          <Input id="b-title" name="invoiceTitle" defaultValue={b.invoiceTitle} maxLength={60} />
        </Field>
        <Field label="Default GST %" htmlFor="b-gst" hint="For parts without their own GST rate.">
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
          hint="Prices for customers who have no price list of their own."
          className="sm:col-span-2"
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
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">Sales rules</p>
        <Tick
          name="allowWalkIn"
          checked={b.allowWalkIn}
          title="Allow walk-in sales"
          note="When off, every invoice must be for a saved customer."
        />
        <Tick
          name="allowShortStock"
          checked={b.allowShortStock}
          title="Allow selling more than the stock in hand"
          note="When off, an invoice is stopped if a part does not have enough stock. Turn on for a while if your stock is not entered yet."
        />
      </div>
    </SectionForm>
  );
}

const NUMBER_FIELDS: { key: keyof BusinessSettings; label: string }[] = [
  { key: "invoicePrefix", label: "Invoices" },
  { key: "receiptPrefix", label: "Payments received" },
  { key: "creditNotePrefix", label: "Credit notes (returns)" },
  { key: "quotePrefix", label: "Quotes" },
  { key: "orderPrefix", label: "Sales orders" },
  { key: "challanPrefix", label: "Delivery challans" },
  { key: "purchaseOrderPrefix", label: "Purchase orders" },
  { key: "vendorPaymentPrefix", label: "Payments made" },
  { key: "debitNotePrefix", label: "Purchase returns (debit notes)" },
  { key: "expensePrefix", label: "Expenses" },
  { key: "adjustmentPrefix", label: "Stock adjustments" },
];

export function NumbersForm({ b, year }: { b: BusinessSettings; year: string }) {
  return (
    <SectionForm section="numbers">
      <div className={grid}>
        {NUMBER_FIELDS.map((f) => {
          const value = String(b[f.key]);
          return (
            <Field key={f.key} label={f.label} htmlFor={`n-${f.key}`} hint={`${value}/${year}/0001`}>
              <Input
                id={`n-${f.key}`}
                name={f.key}
                defaultValue={value}
                maxLength={6}
                autoCapitalize="characters"
                className="uppercase"
              />
            </Field>
          );
        })}
      </div>
    </SectionForm>
  );
}

export function BankForm({ b }: { b: BusinessSettings }) {
  return (
    <SectionForm section="bank">
      <div className={grid}>
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
      </div>
    </SectionForm>
  );
}

export function ReminderSettingsForm({ b }: { b: BusinessSettings }) {
  return (
    <SectionForm section="reminders">
      <div className={grid}>
        <Field
          label="Remind when a bill is unpaid for (days)"
          htmlFor="b-remind"
          hint="A bill with its own due date is reminded the day after that date."
        >
          <Input
            id="b-remind"
            name="paymentReminderDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            step={1}
            defaultValue={b.paymentReminderDays}
          />
        </Field>
        <Field
          label="Low stock level for all parts"
          htmlFor="b-minstock"
          hint="Used for parts without their own minimum. 0 turns it off."
        >
          <Input
            id="b-minstock"
            name="defaultMinStock"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            defaultValue={b.defaultMinStock}
          />
        </Field>
      </div>
    </SectionForm>
  );
}

export function OpeningBalancesForm({ b }: { b: BusinessSettings }) {
  return (
    <SectionForm section="opening">
      <div className={grid}>
        <Field
          label="Opening cash in hand (₹)"
          htmlFor="b-opencash"
          hint="Cash in the shop on the day you started using the app."
        >
          <Input id="b-opencash" name="openingCash" type="number" inputMode="decimal" step="0.01" defaultValue={b.openingCash} />
        </Field>
        <Field label="Opening bank balance (₹)" htmlFor="b-openbank" hint="Money in the bank on that same day.">
          <Input id="b-openbank" name="openingBank" type="number" inputMode="decimal" step="0.01" defaultValue={b.openingBank} />
        </Field>
      </div>
    </SectionForm>
  );
}

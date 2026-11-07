"use client";

import Link from "next/link";
import { useState } from "react";

import { saveCustomer } from "@/app/(app)/customers/actions";
import { GstinHint } from "@/components/forms/gstin-hint";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CUSTOMER_NAME_MAX } from "@/lib/customers/validation";
import { checkGstin, GST_STATE_OPTIONS } from "@/lib/gst";
import type { CustomerDetail, CustomerOptions } from "@/server/customers";

export function CustomerForm({
  customer,
  options,
  cancelHref,
}: {
  customer: CustomerDetail | null;
  options: CustomerOptions;
  cancelHref: string;
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveCustomer.bind(null, customer?.id ?? null));
  const [gstin, setGstin] = useState(customer?.gstin ?? "");
  const gstinState = gstin.trim() ? checkGstin(gstin) : null;
  const activeFields = options.fields.filter((f) => f.active);
  const c = customer;

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-6" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Contact</legend>
        <Field label="Customer / shop name *" htmlFor="c-name" className="sm:col-span-2">
          <Input id="c-name" name="name" defaultValue={c?.name} required maxLength={CUSTOMER_NAME_MAX} autoFocus={!c} />
        </Field>
        <Field label="Contact person" htmlFor="c-contact">
          <Input id="c-contact" name="contactPerson" defaultValue={c?.contactPerson ?? ""} maxLength={200} />
        </Field>
        <Field label="Mobile" htmlFor="c-mobile">
          <Input id="c-mobile" name="mobile" type="tel" inputMode="tel" defaultValue={c?.mobile ?? ""} maxLength={40} />
        </Field>
        <Field label="Email" htmlFor="c-email" className="sm:col-span-2">
          <Input id="c-email" name="email" type="email" defaultValue={c?.email ?? ""} maxLength={200} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Address and GST</legend>
        <Field label="Address" htmlFor="c-address" className="sm:col-span-2">
          <Textarea id="c-address" name="address" rows={2} defaultValue={c?.address ?? ""} maxLength={1000} />
        </Field>
        <Field label="City" htmlFor="c-city">
          <Input id="c-city" name="city" defaultValue={c?.city ?? ""} maxLength={100} />
        </Field>
        <Field label="PIN code" htmlFor="c-pin">
          <Input id="c-pin" name="pincode" inputMode="numeric" defaultValue={c?.pincode ?? ""} maxLength={7} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <Field label="GSTIN" htmlFor="c-gstin">
            <Input
              id="c-gstin"
              name="gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              maxLength={20}
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono uppercase"
            />
          </Field>
          <GstinHint value={gstin} emptyText="Leave empty if the customer has no GSTIN." />
        </div>
        <Field label="State" htmlFor="c-state" hint={gstinState?.ok ? "Taken from the GSTIN" : undefined}>
          <NativeSelect
            id="c-state"
            name="stateCode"
            className="w-full"
            {...(gstinState?.ok
              ? { value: gstinState.stateCode, disabled: true }
              : { defaultValue: c?.stateCode ?? "" })}
          >
            <NativeSelectOption value="">—</NativeSelectOption>
            {GST_STATE_OPTIONS.map((s) => (
              <NativeSelectOption key={s.code} value={s.code}>
                {s.name} ({s.code})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Pricing and credit</legend>
        <Field label="Group" htmlFor="c-group">
          <NativeSelect id="c-group" name="groupId" defaultValue={c?.groupId ?? ""} className="w-full">
            <NativeSelectOption value="">— No group —</NativeSelectOption>
            {options.groups.map((g) => (
              <NativeSelectOption key={g.id} value={g.id}>
                {g.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Price list" htmlFor="c-list" hint="Leave as group's list unless this customer gets special prices.">
          <NativeSelect id="c-list" name="priceListId" defaultValue={c?.priceListId ?? ""} className="w-full">
            <NativeSelectOption value="">Use the group&apos;s price list</NativeSelectOption>
            {options.priceLists.map((l) => (
              <NativeSelectOption key={l.id} value={l.id}>
                {l.name}
                {l.enabled ? "" : " (off)"}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Opening balance (₹)" htmlFor="c-opening">
          <div className="flex gap-2">
            <Input
              id="c-opening"
              name="openingBalance"
              inputMode="decimal"
              defaultValue={c && c.openingBalance !== 0 ? Math.abs(c.openingBalance) : ""}
              placeholder="0"
              className="w-32"
            />
            <NativeSelect
              name="balanceSide"
              aria-label="Who owes whom"
              defaultValue={c && c.openingBalance < 0 ? "we-owe" : "owes-us"}
              className="flex-1"
            >
              <NativeSelectOption value="owes-us">Customer owes us</NativeSelectOption>
              <NativeSelectOption value="we-owe">We owe customer</NativeSelectOption>
            </NativeSelect>
          </div>
        </Field>
        <Field label="Credit limit (₹)" htmlFor="c-limit">
          <Input
            id="c-limit"
            name="creditLimit"
            inputMode="decimal"
            defaultValue={c?.creditLimit ?? ""}
            placeholder="No limit"
          />
        </Field>
        <Field label="Payment terms (days)" htmlFor="c-terms" hint="0 = pay on the spot">
          <Input
            id="c-terms"
            name="paymentTermsDays"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={c?.paymentTermsDays ?? ""}
            placeholder="e.g. 30"
          />
        </Field>
      </fieldset>

      {activeFields.length > 0 && (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-medium text-muted-foreground">More details</legend>
          {activeFields.map((f) => (
            <Field key={f.id} label={f.label} htmlFor={`c-extra-${f.id}`}>
              <Input
                id={`c-extra-${f.id}`}
                name={`extra.${f.id}`}
                type={f.type === "date" ? "date" : "text"}
                inputMode={f.type === "number" ? "decimal" : undefined}
                defaultValue={c?.extra[String(f.id)] ?? ""}
                maxLength={1000}
              />
            </Field>
          ))}
        </fieldset>
      )}

      <Field label="Notes" htmlFor="c-notes">
        <Textarea id="c-notes" name="notes" rows={3} defaultValue={c?.notes ?? ""} maxLength={5000} />
      </Field>

      {c && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={c.active} className="mt-0.5 size-4 accent-primary" />
          <span>
            Active customer
            <span className="block text-muted-foreground">
              Inactive customers are hidden from search but their history is kept.
            </span>
          </span>
        </label>
      )}

      <SaveRow state={state} pending={pending} dirty={dirty} label={c ? "Save changes" : "Add customer"}>
        <Link href={cancelHref} scroll={false} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </SaveRow>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

import { saveVendor } from "@/app/(app)/vendors/actions";
import { GstinHint } from "@/components/forms/gstin-hint";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip } from "@/components/ui/info-tip";
import { checkGstin, GST_STATE_OPTIONS } from "@/lib/gst";
import { VENDOR_NAME_MAX } from "@/lib/vendors/validation";
import type { VendorDetail } from "@/server/vendors";

export function VendorForm({ vendor, cancelHref }: { vendor: VendorDetail | null; cancelHref: string }) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveVendor.bind(null, vendor?.id ?? null));
  const [gstin, setGstin] = useState(vendor?.gstin ?? "");
  const gstinState = gstin.trim() ? checkGstin(gstin) : null;
  const v = vendor;

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-6" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Contact</legend>
        <Field label="Vendor / company name *" htmlFor="v-name" className="sm:col-span-2">
          <Input id="v-name" name="name" defaultValue={v?.name} required maxLength={VENDOR_NAME_MAX} autoFocus={!v} />
        </Field>
        <Field label="Contact person" htmlFor="v-contact">
          <Input id="v-contact" name="contactPerson" defaultValue={v?.contactPerson ?? ""} maxLength={200} />
        </Field>
        <Field label="Mobile" htmlFor="v-mobile">
          <Input id="v-mobile" name="mobile" type="tel" inputMode="tel" defaultValue={v?.mobile ?? ""} maxLength={40} />
        </Field>
        <Field label="Email" htmlFor="v-email" className="sm:col-span-2">
          <Input id="v-email" name="email" type="email" defaultValue={v?.email ?? ""} maxLength={200} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Address and GST</legend>
        <Field label="Address" htmlFor="v-address" className="sm:col-span-2">
          <Textarea id="v-address" name="address" rows={2} defaultValue={v?.address ?? ""} maxLength={1000} />
        </Field>
        <Field label="City" htmlFor="v-city">
          <Input id="v-city" name="city" defaultValue={v?.city ?? ""} maxLength={100} />
        </Field>
        <Field label="PIN code" htmlFor="v-pin">
          <Input id="v-pin" name="pincode" inputMode="numeric" defaultValue={v?.pincode ?? ""} maxLength={7} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <Field label="GSTIN" htmlFor="v-gstin" hint="The 15-letter tax number on their bills. Leave it empty if they have none.">
            <Input
              id="v-gstin"
              name="gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              maxLength={20}
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono uppercase"
            />
          </Field>
          <GstinHint value={gstin} />
        </div>
        <Field
          label="State"
          htmlFor="v-state"
          hint="Their state decides the tax on their bills: same state = CGST + SGST, other state = IGST."
          note={gstinState?.ok ? "Taken from the GSTIN" : undefined}
        >
          <NativeSelect
            id="v-state"
            name="stateCode"
            className="w-full"
            {...(gstinState?.ok
              ? { value: gstinState.stateCode, disabled: true }
              : { defaultValue: v?.stateCode ?? "" })}
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
        <legend className="mb-3 text-sm font-medium text-muted-foreground">Balance and terms</legend>
        <Field label="Opening balance (₹)" htmlFor="v-opening">
          <div className="flex gap-2">
            <Input
              id="v-opening"
              name="openingBalance"
              inputMode="decimal"
              defaultValue={v && v.openingBalance !== 0 ? Math.abs(v.openingBalance) : ""}
              placeholder="0"
              className="w-32"
            />
            <NativeSelect
              name="balanceSide"
              aria-label="Who owes whom"
              defaultValue={v && v.openingBalance < 0 ? "owes-us" : "we-owe"}
              className="flex-1"
            >
              <NativeSelectOption value="we-owe">We owe vendor</NativeSelectOption>
              <NativeSelectOption value="owes-us">Vendor owes us</NativeSelectOption>
            </NativeSelect>
          </div>
        </Field>
        <Field label="Payment terms (days)" htmlFor="v-terms" hint="How many days you get to pay them. Sets the due date on their bills.">
          <Input
            id="v-terms"
            name="paymentTermsDays"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={v?.paymentTermsDays ?? ""}
            placeholder="e.g. 30"
          />
        </Field>
      </fieldset>

      <Field label="Notes" htmlFor="v-notes">
        <Textarea id="v-notes" name="notes" rows={3} defaultValue={v?.notes ?? ""} maxLength={5000} />
      </Field>

      {v && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={v.active} className="mt-0.5 size-4 accent-primary" />
          <span>
            Active vendor{" "}
            <InfoTip label="About Active vendor">Untick to hide this vendor from search. Their history is kept.</InfoTip>
          </span>
        </label>
      )}

      <SaveRow state={state} pending={pending} dirty={dirty} label={v ? "Save changes" : "Add vendor"}>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </SaveRow>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

import { savePayment } from "@/app/(app)/payments/actions";
import { Balance } from "@/components/customers/balance";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { CustomerPicker } from "@/components/invoices/customer-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import { PAYMENT_MAX, PAYMENT_MODE_LABELS, PAYMENT_MODES, type PaymentMode } from "@/lib/payments/validation";
import type { PickedCustomer } from "@/server/invoices";

export interface PaymentFormValues {
  customer: PickedCustomer | null;
  date: string;
  amount: number | null;
  mode: PaymentMode;
  reference: string;
  notes: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function PaymentForm({
  id,
  initial,
  backHref,
}: {
  /** null for a new payment. */
  id: number | null;
  initial: PaymentFormValues;
  backHref: string;
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(savePayment.bind(null, id));
  const [customer, setCustomer] = useState(initial.customer);
  const [amount, setAmount] = useState(initial.amount == null ? "" : String(initial.amount));

  // When editing, the customer's balance already counts this payment; add it back to see what they owe.
  const sameCustomer = id != null && customer != null && customer.id === initial.customer?.id;
  const owed = customer ? round2(customer.balance + (sameCustomer ? (initial.amount ?? 0) : 0)) : 0;
  const entered = Number(amount.replace(/[,\s₹]/g, ""));
  const valid = amount.trim() !== "" && Number.isFinite(entered) && entered > 0;
  const after = customer && valid ? round2(owed - entered) : null;

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      <input type="hidden" name="customerId" value={customer?.id ?? ""} />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Customer</span>
        <CustomerPicker value={customer} onChange={setCustomer} />
      </div>

      {customer && (
        <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          Before this payment: <Balance amount={owed} className="font-medium" />
          {owed > 0 && (
            <Button type="button" variant="outline" size="xs" onClick={() => setAmount(String(owed))}>
              Receive full {formatMoney(owed)}
            </Button>
          )}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount received (₹)" htmlFor="p-amount">
          <Input
            id="p-amount"
            name="amount"
            inputMode="decimal"
            required
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="h-10 text-lg font-medium tabular-nums"
            aria-describedby="p-amount-after"
          />
        </Field>
        <Field label="Date" htmlFor="p-date">
          <Input id="p-date" name="date" type="date" required defaultValue={initial.date} className="h-10" />
        </Field>
      </div>

      {after != null && (
        <p id="p-amount-after" className="-mt-2 text-sm text-muted-foreground" aria-live="polite">
          {entered > PAYMENT_MAX ? (
            <span className="text-destructive">That amount looks too large; please check it.</span>
          ) : (
            <>
              After this payment: <Balance amount={after} className="font-medium" />
              {after < 0 && owed >= 0 && " (kept as advance for their next bills)"}
            </>
          )}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paid by" htmlFor="p-mode">
          <NativeSelect id="p-mode" name="mode" defaultValue={initial.mode} className="w-full">
            {PAYMENT_MODES.map((m) => (
              <NativeSelectOption key={m} value={m}>
                {PAYMENT_MODE_LABELS[m]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Reference (optional)" htmlFor="p-ref">
          <Input
            id="p-ref"
            name="reference"
            defaultValue={initial.reference}
            maxLength={100}
            autoComplete="off"
            placeholder="UPI ref, cheque no…"
          />
        </Field>
      </div>

      <Field label="Notes (optional)" htmlFor="p-notes">
        <Textarea id="p-notes" name="notes" defaultValue={initial.notes} maxLength={1000} rows={2} />
      </Field>

      <SaveRow state={state} pending={pending} dirty={dirty} label={id == null ? "Save payment" : "Save changes"}>
        <Link href={backHref} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </SaveRow>
    </form>
  );
}

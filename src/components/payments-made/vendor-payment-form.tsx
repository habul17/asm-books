"use client";

import Link from "next/link";
import { useState } from "react";

import { saveVendorPayment, scanSlipAction } from "@/app/(app)/payments-made/actions";
import { VendorBalance as Balance } from "@/components/vendors/vendor-balance";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { ScanBox, ScanWarnings } from "@/components/forms/scan-box";
import { VendorPicker } from "@/components/vendors/vendor-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import type { PaidSlipResult } from "@/server/bill-scan/payment-slip";
import { PAYMENT_MAX, PAYMENT_MODE_LABELS, PAYMENT_MODES, type PaymentMode } from "@/lib/payments/validation";
import type { PickedVendor } from "@/server/vendors";

export interface VendorPaymentFormValues {
  vendor: PickedVendor | null;
  date: string;
  amount: number | null;
  mode: PaymentMode;
  reference: string;
  notes: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

type FormProps = {
  /** null for a new payment. */
  id: number | null;
  initial: VendorPaymentFormValues;
  backHref: string;
};

/** Values for the form from a scanned slip, keeping what the slip does not say. */
function fromSlip(base: VendorPaymentFormValues, r: PaidSlipResult): VendorPaymentFormValues {
  return {
    ...base,
    // A vendor already chosen (opened from their page) is kept; a mismatch is warned about below.
    vendor: base.vendor ?? r.vendor,
    date: r.date ?? base.date,
    amount: r.amount,
    mode: r.mode ?? base.mode,
    reference: r.reference ?? "",
    notes: r.notes ?? "",
  };
}

function slipWarnings(base: FormProps["initial"], r: Parameters<typeof fromSlip>[1]): string[] {
  const chosen = base.vendor;
  if (chosen && r.vendor && r.vendor.id !== chosen.id) {
    return [`This slip looks like it is from ${r.vendor.name}, not ${chosen.name}. Check the vendor.`, ...r.warnings];
  }
  return r.warnings;
}

export function VendorPaymentForm({ scanReady = false, ...props }: FormProps & { scanReady?: boolean }) {
  const [scanned, setScanned] = useState<{ n: number; values: VendorPaymentFormValues; warnings: string[]; keptId?: number } | null>(null);
  if (props.id != null) return <PaymentFields {...props} />;
  return (
    <div className="flex flex-col gap-5">
      <ScanBox
        keep
        ready={scanReady}
        noun="payment slip"
        say="who you paid, how much, and how (UPI, cash, cheque)"
        help="Take a screenshot of the UPI or bank payment you made, or a photo of the cheque. The form below is filled in for you to check."
        action={scanSlipAction}
        onScan={(r: PaidSlipResult, keptId?: number) =>
          setScanned((prev) => ({ n: (prev?.n ?? 0) + 1, keptId, values: fromSlip(props.initial, r), warnings: slipWarnings(props.initial, r) }))
        }
      />
      {scanned && <ScanWarnings warnings={scanned.warnings} />}
      {/* A new key starts the form again with the scanned values. */}
      <PaymentFields key={scanned?.n ?? 0} {...props} initial={scanned?.values ?? props.initial} scanDocumentId={scanned?.keptId} />
    </div>
  );
}

function PaymentFields({ id, initial, backHref, scanDocumentId }: FormProps & { scanDocumentId?: number }) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveVendorPayment.bind(null, id));
  const [vendor, setVendor] = useState(initial.vendor);
  const [amount, setAmount] = useState(initial.amount == null ? "" : String(initial.amount));

  // When editing, the vendor's balance already counts this payment; add it back to see what we owe them.
  const sameVendor = id != null && vendor != null && vendor.id === initial.vendor?.id;
  const owed = vendor ? round2(vendor.balance + (sameVendor ? (initial.amount ?? 0) : 0)) : 0;
  const entered = Number(amount.replace(/[,\s₹]/g, ""));
  const valid = amount.trim() !== "" && Number.isFinite(entered) && entered > 0;
  const after = vendor && valid ? round2(owed - entered) : null;

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      {scanDocumentId != null && <input type="hidden" name="scanDocumentId" value={scanDocumentId} />}
      <input type="hidden" name="vendorId" value={vendor?.id ?? ""} />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Vendor</span>
        <VendorPicker value={vendor} onChange={setVendor} />
      </div>

      {vendor && (
        <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          Before this payment: <Balance amount={owed} className="font-medium" />
          {owed > 0 && (
            <Button type="button" variant="outline" size="xs" onClick={() => setAmount(String(owed))}>
              Pay full {formatMoney(owed)}
            </Button>
          )}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount paid (₹)" htmlFor="p-amount">
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
              {after < 0 && owed >= 0 && " (paid in advance for their next bills)"}
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

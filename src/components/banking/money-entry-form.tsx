"use client";

import Link from "next/link";
import { useState } from "react";

import { saveMoneyEntry } from "@/app/(app)/banking/actions";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { MONEY_KIND_INFO, MONEY_KINDS, type MoneyKind } from "@/lib/banking/entries";
import { PAYMENT_MODE_LABELS, PAYMENT_MODES } from "@/lib/payments/validation";

const GROUPS: { label: string; kinds: MoneyKind[] }[] = [
  { label: "Money in", kinds: MONEY_KINDS.filter((k) => MONEY_KIND_INFO[k].flow === "in") },
  { label: "Money out", kinds: MONEY_KINDS.filter((k) => MONEY_KIND_INFO[k].flow === "out") },
  { label: "Between cash and bank", kinds: MONEY_KINDS.filter((k) => MONEY_KIND_INFO[k].flow === "transfer") },
];

export function MoneyEntryForm({ today, initialKind }: { today: string; initialKind: MoneyKind }) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveMoneyEntry);
  const [kind, setKind] = useState<MoneyKind>(initialKind);
  const info = MONEY_KIND_INFO[kind];

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      <Field label="What was it?" htmlFor="m-kind" hint={info.hint}>
        <NativeSelect
          id="m-kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(MONEY_KINDS.find((k) => k === e.target.value) ?? initialKind)}
          className="w-full"
        >
          {GROUPS.map((g) => (
            <NativeSelectOptGroup key={g.label} label={g.label}>
              {g.kinds.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {MONEY_KIND_INFO[k].label}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₹)" htmlFor="m-amount">
          <Input
            id="m-amount"
            name="amount"
            inputMode="decimal"
            required
            autoComplete="off"
            placeholder="0.00"
            className="h-10 text-lg font-medium tabular-nums"
          />
        </Field>
        <Field label="Date" htmlFor="m-date">
          <Input id="m-date" name="date" type="date" required max={today} defaultValue={today} className="h-10" />
        </Field>
      </div>

      {info.flow !== "transfer" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={info.flow === "in" ? "Received by" : "Paid by"} htmlFor="m-mode" hint="Cash is the shop's cash; the others are the bank.">
            <NativeSelect id="m-mode" name="mode" defaultValue="bank" className="w-full">
              {PAYMENT_MODES.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {PAYMENT_MODE_LABELS[m]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {info.party && (
            <Field label={`${info.party} (optional)`} htmlFor="m-party">
              <Input id="m-party" name="party" maxLength={100} autoComplete="off" />
            </Field>
          )}
        </div>
      )}

      <Field label="Reference (optional)" htmlFor="m-ref">
        <Input id="m-ref" name="reference" maxLength={100} autoComplete="off" placeholder="Challan no, UTR, cheque no…" />
      </Field>

      <Field label="Notes (optional)" htmlFor="m-notes">
        <Textarea id="m-notes" name="notes" maxLength={1000} rows={2} />
      </Field>

      <SaveRow state={state} pending={pending} dirty={dirty} label="Save entry">
        <Link href="/banking" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </SaveRow>
    </form>
  );
}

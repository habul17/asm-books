"use client";

import Link from "next/link";
import { useState } from "react";

import { saveRecurring } from "@/app/(app)/recurring/actions";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FREQUENCIES, FREQUENCY_LABELS, suggestedStart, type Frequency } from "@/lib/recurring/schedule";

export function RecurringForm({ invoiceId, invoiceDate, today }: { invoiceId: number; invoiceDate: string; today: string }) {
  const { state, pending, onSubmit, onChange } = useSaveForm(saveRecurring);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [nextDate, setNextDate] = useState(() => suggestedStart(invoiceDate, "monthly", today));
  const [dateEdited, setDateEdited] = useState(false);

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How often" htmlFor="r-frequency">
          <NativeSelect
            id="r-frequency"
            name="frequency"
            value={frequency}
            onChange={(e) => {
              const next = FREQUENCIES.find((f) => f === e.target.value) ?? "monthly";
              setFrequency(next);
              // Follow the choice until the user picks a date by hand.
              if (!dateEdited) setNextDate(suggestedStart(invoiceDate, next, today));
            }}
            className="w-full"
          >
            {FREQUENCIES.map((f) => (
              <NativeSelectOption key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Next invoice on" htmlFor="r-next" hint="Later invoices fall on the same day of the month.">
          <Input
            id="r-next"
            name="nextDate"
            type="date"
            required
            value={nextDate}
            onChange={(e) => {
              setDateEdited(true);
              setNextDate(e.target.value);
            }}
            className="h-10"
          />
        </Field>
      </div>
      <Field label="Stop after (optional)" htmlFor="r-end" hint="Leave empty to repeat until you stop it.">
        <Input id="r-end" name="endDate" type="date" min={nextDate} className="h-10 sm:w-1/2" />
      </Field>
      <Field label="Notes (optional)" htmlFor="r-notes">
        <Textarea id="r-notes" name="notes" maxLength={500} rows={2} placeholder="e.g. Monthly service contract" />
      </Field>
      <SaveRow state={state} pending={pending} dirty label="Start repeating">
        <Link href={`/invoices/${invoiceId}`} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </SaveRow>
    </form>
  );
}

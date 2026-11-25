"use client";

import Link from "next/link";
import { useState } from "react";

import { saveShareExpense } from "@/app/(app)/profit-share/actions";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  MAX_NAME,
  PARTNER_NAMES,
  PARTNERS,
  REPEAT_LABELS,
  REPEATS,
  scheduleSentence,
  type Repeat,
  type ShareExpense,
} from "@/lib/profit-share/share";
import { isIsoDate } from "@/lib/reports/period";

/** Adds an expense taken from the partners' profit, or changes one. */
export function ShareExpenseForm({ expense, today }: { expense?: ShareExpense; today: string }) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveShareExpense);
  const [repeat, setRepeat] = useState<Repeat>(expense?.repeat ?? "monthly");
  const [start, setStart] = useState(expense?.start ?? today);
  const [end, setEnd] = useState(expense?.end ?? "");
  const monthly = repeat === "monthly";
  const sentence = isIsoDate(start)
    ? scheduleSentence({ repeat, start, end: monthly && isIsoDate(end) ? end : null })
    : null;

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <Field label="What is it for?" htmlFor="x-name">
        <Input
          id="x-name"
          name="name"
          required
          maxLength={MAX_NAME}
          autoComplete="off"
          defaultValue={expense?.name}
          placeholder="e.g. Shop rent"
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-4">
          {PARTNERS.map((p) => (
            <Field key={p} label={`From ${PARTNER_NAMES[p]} (₹)`} htmlFor={`x-${p}`}>
              <Input
                id={`x-${p}`}
                name={p}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                defaultValue={expense && expense[p] > 0 ? String(expense[p]) : ""}
                className="text-lg font-medium tabular-nums"
              />
            </Field>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Taken off each one&apos;s half of the profit. Leave one empty if it is only for the other.
        </p>
      </div>

      <Field label="How often" htmlFor="x-repeat">
        <NativeSelect
          id="x-repeat"
          name="repeat"
          value={repeat}
          onChange={(e) => setRepeat(REPEATS.find((r) => r === e.target.value) ?? "monthly")}
          className="w-full"
        >
          {REPEATS.map((r) => (
            <NativeSelectOption key={r} value={r}>
              {REPEAT_LABELS[r]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={monthly ? "Start date" : "Date"} htmlFor="x-start">
            <Input id="x-start" name="start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          {monthly && (
            <Field label="End date (optional)" htmlFor="x-end">
              <Input id="x-end" name="end" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          )}
        </div>
        {sentence && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {sentence}
            {monthly && !end ? " Leave the end date empty to keep it going." : ""}
          </p>
        )}
      </div>

      <SaveRow state={state} pending={pending} dirty={dirty} label="Save expense">
        <Link href="/profit-share" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </SaveRow>
    </form>
  );
}

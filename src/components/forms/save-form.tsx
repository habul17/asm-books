"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Label } from "@/components/ui/label";

export interface FormState {
  ok?: boolean;
  error?: string;
}

export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Submits through a server action without React's automatic form reset, so
 * the user's typing is kept when the server rejects a value.
 */
export function useSaveForm(action: FormAction, { resetOnSuccess = false } = {}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear "add new" forms once the item is saved.
  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setDirty(false);
    startTransition(() => formAction(data));
  };
  return { state, pending, onSubmit, onChange: () => setDirty(true), dirty, formRef };
}

/** Save button with the result message next to it. */
export function SaveRow({
  state,
  pending,
  dirty,
  label = "Save",
  children,
}: {
  state: FormState;
  pending: boolean;
  dirty: boolean;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
      {children}
      <span aria-live="polite" className="text-sm">
        {state.error ? (
          <span className="text-destructive">{state.error}</span>
        ) : state.ok && !dirty && !pending ? (
          <span className="text-emerald-600 dark:text-emerald-400">Saved ✓</span>
        ) : null}
      </span>
    </div>
  );
}

/** Puts the cursor in a text box with its text selected when `enabled` is true. */
export function useSelectOnMount(enabled: boolean) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (enabled) ref.current?.select();
  }, [enabled]);
  return ref;
}

/**
 * A label above an input. `hint` is an explanation, tucked behind an (i) next
 * to the label; `note` is live information (a preview, "Taken from the GSTIN")
 * shown under the input.
 */
export function Field({
  label,
  htmlFor,
  hint,
  note,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  note?: ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex min-h-5 items-center gap-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <InfoTip label={`About ${label}`}>{hint}</InfoTip>}
      </div>
      {children}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

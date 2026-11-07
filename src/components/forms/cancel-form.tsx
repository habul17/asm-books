"use client";

import { useSaveForm, type FormAction } from "@/components/forms/save-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** A folded "Cancel this …" box that asks for a reason before cancelling. */
export function CancelForm({
  action,
  title,
  explanation,
  button,
}: {
  action: FormAction;
  title: string;
  explanation: string;
  button: string;
}) {
  const { state, pending, onSubmit } = useSaveForm(action);
  return (
    <details className="rounded-lg border px-4 py-3 text-sm print:hidden">
      <summary className="cursor-pointer font-medium text-destructive">{title}</summary>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
        <p className="text-muted-foreground">{explanation}</p>
        <Textarea name="reason" required maxLength={500} rows={2} placeholder="Reason, e.g. entered by mistake" />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="destructive" size="sm" disabled={pending}>
            {pending ? "Cancelling…" : button}
          </Button>
          {state.error && <span className="text-destructive">{state.error}</span>}
        </div>
      </form>
    </details>
  );
}

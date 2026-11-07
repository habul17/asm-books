"use client";

import { PrinterIcon } from "lucide-react";

import { cancelInvoiceAction } from "@/app/(app)/invoices/actions";
import { useSaveForm } from "@/components/forms/save-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PrintButton() {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
      <PrinterIcon /> Print / PDF
    </Button>
  );
}

export function CancelInvoiceForm({ id }: { id: number }) {
  const { state, pending, onSubmit } = useSaveForm(cancelInvoiceAction.bind(null, id));
  return (
    <details className="rounded-lg border px-4 py-3 text-sm print:hidden">
      <summary className="cursor-pointer font-medium text-destructive">Cancel this invoice</summary>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
        <p className="text-muted-foreground">
          The invoice stays in the list marked as cancelled, its number is kept, its stock goes back and it no longer
          counts in the customer&apos;s balance. This cannot be undone.
        </p>
        <Textarea name="reason" required maxLength={500} rows={2} placeholder="Reason, e.g. billed by mistake" />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="destructive" size="sm" disabled={pending}>
            {pending ? "Cancelling…" : "Cancel invoice"}
          </Button>
          {state.error && <span className="text-destructive">{state.error}</span>}
        </div>
      </form>
    </details>
  );
}

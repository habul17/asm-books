"use client";

import { PrinterIcon } from "lucide-react";

import { cancelInvoiceAction } from "@/app/(app)/invoices/actions";
import { CancelForm } from "@/components/forms/cancel-form";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
      <PrinterIcon /> Print / PDF
    </Button>
  );
}

export function CancelInvoiceForm({ id }: { id: number }) {
  return (
    <CancelForm
      action={cancelInvoiceAction.bind(null, id)}
      title="Cancel this invoice"
      explanation="The invoice stays in the list marked as cancelled, its number is kept, its stock goes back and it no longer counts in the customer's balance. This cannot be undone."
      button="Cancel invoice"
    />
  );
}

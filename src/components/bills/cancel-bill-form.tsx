"use client";

import { cancelBillAction } from "@/app/(app)/bills/actions";
import { CancelForm } from "@/components/forms/cancel-form";

export function CancelBillForm({ id }: { id: number }) {
  return (
    <CancelForm
      action={cancelBillAction.bind(null, id)}
      title="Cancel this bill"
      explanation="The bill stays in the list marked as cancelled. Its parts are taken back out of stock, the parts go back to their earlier purchase prices, and it no longer counts in what you owe the vendor. This cannot be undone."
      button="Cancel bill"
    />
  );
}

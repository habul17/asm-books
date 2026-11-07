"use client";

import { cancelPaymentAction } from "@/app/(app)/payments/actions";
import { CancelForm } from "@/components/forms/cancel-form";

export function CancelPaymentForm({ id }: { id: number }) {
  return (
    <CancelForm
      action={cancelPaymentAction.bind(null, id)}
      title="Cancel this payment"
      explanation="The receipt stays in the list marked as cancelled, its number is kept, and the amount is added back to what the customer owes. This cannot be undone."
      button="Cancel payment"
    />
  );
}

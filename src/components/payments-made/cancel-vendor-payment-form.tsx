"use client";

import { cancelVendorPaymentAction } from "@/app/(app)/payments-made/actions";
import { CancelForm } from "@/components/forms/cancel-form";

export function CancelVendorPaymentForm({ id }: { id: number }) {
  return (
    <CancelForm
      action={cancelVendorPaymentAction.bind(null, id)}
      title="Cancel this payment"
      explanation="The payment stays in the list marked as cancelled, its number is kept, and the amount is added back to what you owe the vendor. This cannot be undone."
      button="Cancel payment"
    />
  );
}

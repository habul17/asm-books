"use client";

import { cancelPurchaseReturnAction } from "@/app/(app)/purchase-returns/actions";
import { CancelForm } from "@/components/forms/cancel-form";

export function CancelPurchaseReturnForm({ id }: { id: number }) {
  return (
    <CancelForm
      action={cancelPurchaseReturnAction.bind(null, id)}
      title="Cancel this purchase return"
      explanation="The return stays in the list marked as cancelled and its number is kept. The parts come back into stock and the amount is added back to what you owe the vendor. This cannot be undone."
      button="Cancel return"
    />
  );
}

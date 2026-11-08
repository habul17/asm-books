"use client";

import { cancelAdjustmentAction } from "@/app/(app)/inventory-adjustments/actions";
import { CancelForm } from "@/components/forms/cancel-form";

export function CancelAdjustmentForm({ id }: { id: number }) {
  return (
    <CancelForm
      action={cancelAdjustmentAction.bind(null, id)}
      title="Cancel this adjustment"
      explanation="Every part's stock is changed back by the same amount, and the adjustment stays in the list marked as cancelled. This cannot be undone."
      button="Cancel adjustment"
    />
  );
}

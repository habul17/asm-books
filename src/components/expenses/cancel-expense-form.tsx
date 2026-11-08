"use client";

import { cancelExpenseAction } from "@/app/(app)/expenses/actions";
import { CancelForm } from "@/components/forms/cancel-form";

export function CancelExpenseForm({ id }: { id: number }) {
  return (
    <CancelForm
      action={cancelExpenseAction.bind(null, id)}
      title="Cancel this expense"
      explanation="The expense stays in the list marked as cancelled and its number is kept, but it no longer counts in your totals. This cannot be undone."
      button="Cancel expense"
    />
  );
}

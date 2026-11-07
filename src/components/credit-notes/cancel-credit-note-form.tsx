"use client";

import { cancelCreditNoteAction } from "@/app/(app)/credit-notes/actions";
import { CancelForm } from "@/components/forms/cancel-form";

export function CancelCreditNoteForm({ id }: { id: number }) {
  return (
    <CancelForm
      action={cancelCreditNoteAction.bind(null, id)}
      title="Cancel this credit note"
      explanation="The credit note stays in the list marked as cancelled and its number is kept. Parts that went back in stock are taken out again, and a credit to the customer's account is removed. This cannot be undone."
      button="Cancel credit note"
    />
  );
}

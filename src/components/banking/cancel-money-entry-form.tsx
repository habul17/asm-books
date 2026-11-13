"use client";

import { cancelMoneyEntryAction } from "@/app/(app)/banking/actions";
import { CancelForm } from "@/components/forms/cancel-form";

export function CancelMoneyEntryForm({ id }: { id: number }) {
  return (
    <CancelForm
      action={cancelMoneyEntryAction.bind(null, id)}
      title="Cancel this entry"
      explanation="The entry stays in the list marked as cancelled, but it no longer counts in the cash and bank balances or in the reports. To correct a mistake, cancel it and enter it again. This cannot be undone."
      button="Cancel entry"
    />
  );
}

"use client";

import { useState, useTransition } from "react";

import { setPurchaseOrderStatusAction } from "@/app/(app)/purchase-orders/actions";
import { Button } from "@/components/ui/button";
import type { PurchaseOrderStatus } from "@/lib/purchase-orders/validation";

/** Close, reopen or cancel a purchase order. Cancelling needs a second click. */
export function PurchaseOrderStatusButtons({
  id,
  status,
  billed,
}: {
  id: number;
  status: PurchaseOrderStatus;
  /** True when a bill was entered for it; it is then closed, never cancelled. */
  billed: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  const change = (to: PurchaseOrderStatus) => {
    setError(null);
    setArmed(false);
    startTransition(async () => {
      const result = await setPurchaseOrderStatusAction(id, to);
      if (result?.error) setError(result.error);
    });
  };

  if (status === "cancelled") return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
      {status === "open" ? (
        <>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => change("closed")}>
            Mark as closed
          </Button>
          {!billed && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => (armed ? change("cancelled") : setArmed(true))}
            >
              {armed ? "Click again to cancel" : "Cancel purchase order"}
            </Button>
          )}
          <span className="text-muted-foreground">Close it when nothing more will come on this order.</span>
        </>
      ) : (
        <>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => change("open")}>
            Reopen
          </Button>
          <span className="text-muted-foreground">Reopen it when some parts are still to come.</span>
        </>
      )}
      {error && (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

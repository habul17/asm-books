"use client";

import { useState, useTransition } from "react";

import { setSalesDocStatusAction } from "@/app/(app)/sales/actions";
import { Button } from "@/components/ui/button";
import { SALES_DOC_KIND, type SalesDocKind, type SalesDocStatus } from "@/lib/sales-docs/kinds";

/** Close, reopen or cancel a quote, sales order or delivery challan. Cancelling needs a second click. */
export function SalesDocStatusButtons({
  kind,
  id,
  status,
  invoiced,
}: {
  kind: SalesDocKind;
  id: number;
  status: SalesDocStatus;
  /** True when it became an invoice; reopening is then done by cancelling that invoice. */
  invoiced: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const noun = SALES_DOC_KIND[kind].noun;

  const change = (to: "open" | "closed" | "cancelled") => {
    setError(null);
    setArmed(false);
    startTransition(async () => {
      const result = await setSalesDocStatusAction(kind, id, to);
      if (result?.error) setError(result.error);
    });
  };

  if (status === "cancelled" || (status === "closed" && invoiced)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
      {status === "open" ? (
        <>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => change("closed")}>
            Mark as closed
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => (armed ? change("cancelled") : setArmed(true))}
          >
            {armed ? "Click again to cancel" : `Cancel ${noun}`}
          </Button>
          <span className="text-muted-foreground">Close it when it is finished without an invoice.</span>
        </>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => change("open")}>
          Reopen
        </Button>
      )}
      {error && (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

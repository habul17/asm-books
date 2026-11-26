"use client";

import { EyeOffIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { deactivateCustomer, deleteCustomer } from "@/app/(app)/customers/actions";
import { Button } from "@/components/ui/button";

const CONFIRM_MS = 4000;

/** Delete needs two taps. A customer with history can only be made inactive. */
export function DeleteCustomerButton({ id, active }: { id: number; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canHide, setCanHide] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function onDelete() {
    if (!armed) {
      setArmed(true);
      setError(null);
      timer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
      return;
    }
    clearTimeout(timer.current);
    setArmed(false);
    startTransition(async () => {
      const result = await deleteCustomer(id);
      if (result?.error) {
        setError(result.error);
        setCanHide(!!result.hasHistory && active);
      }
    });
  }

  function onHide() {
    startTransition(async () => {
      const result = await deactivateCustomer(id);
      if (result.error) setError(result.error);
      else {
        setError(null);
        setCanHide(false);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={armed ? "destructive" : "outline"}
        size="sm"
        disabled={pending}
        onClick={onDelete}
        className="rounded-full"
      >
        <Trash2Icon /> {armed ? "Tap again to delete" : "Delete"}
      </Button>
      {error && (
        <div role="alert" className="flex basis-full flex-col items-start gap-2 text-sm text-destructive">
          <p>{error}</p>
          {canHide && (
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onHide} className="rounded-full">
              <EyeOffIcon /> Make inactive
            </Button>
          )}
        </div>
      )}
    </>
  );
}

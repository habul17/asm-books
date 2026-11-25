"use client";

import { Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { deleteShareExpense } from "@/app/(app)/profit-share/actions";
import { Button } from "@/components/ui/button";

const CONFIRM_MS = 4000;

/** Delete needs two taps. */
export function DeleteShareExpenseButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const result = await deleteShareExpense(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant={armed ? "destructive" : "outline"} size="sm" disabled={pending} onClick={onDelete}>
        <Trash2Icon /> {armed ? "Tap again to delete" : "Delete expense"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Deleting takes it off every month, past months too. To stop it from now on, set an end date instead.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

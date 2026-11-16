"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

/**
 * Deletes a record for good. Needs a second click; `action` deletes and returns the
 * page to go to next, or an error to show.
 */
export function DeleteButton({
  noun,
  action,
  note,
}: {
  noun: string;
  action: () => Promise<{ error?: string; href?: string }>;
  note?: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result: { error?: string; href?: string } = await action().catch(() => ({ error: "Could not delete. Check your internet and try again." }));
      if (result.error) {
        setError(result.error);
        setArmed(false);
      } else if (result.href) router.replace(result.href);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
      <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => (armed ? remove() : setArmed(true))}>
        <Trash2Icon /> {pending ? "Deleting…" : armed ? "Click again to delete for good" : `Delete ${noun}`}
      </Button>
      {armed && !pending && (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
            Keep it
          </Button>
          {note && <span className="text-muted-foreground">{note}</span>}
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

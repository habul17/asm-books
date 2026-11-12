"use client";

import { Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import { deleteDocumentAction } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";

/** Owner only. Deleting needs a second click, because the file cannot be brought back. */
export function DeleteDocumentButton({ id }: { id: number }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteDocumentAction(id);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => (armed ? remove() : setArmed(true))}>
        <Trash2Icon /> {armed ? "Click again to delete for good" : "Delete document"}
      </Button>
      {armed && !pending && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
          Keep it
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

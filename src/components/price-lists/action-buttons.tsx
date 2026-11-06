"use client";

import { FolderPlusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  createFolder,
  createPriceList,
  deleteFolder,
  deletePriceList,
  type ActionState,
} from "@/app/(app)/price-lists/actions";
import { Button } from "@/components/ui/button";

/** Runs a server action and shows its error message, if any, next to the button. */
function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionState>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
    });
  };
  return { pending, error, run };
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;
}

export function NewFolderButton({ parentId, label = "Folder" }: { parentId: number | null; label?: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => createFolder(parentId))}>
        <FolderPlusIcon /> {label}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

export function NewPriceListButton({ folderId, label = "Price list" }: { folderId: number | null; label?: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => createPriceList(folderId))}>
        <PlusIcon /> {label}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

const CONFIRM_MS = 4000;

/** Delete needs two clicks, so a slip of the finger never removes anything. */
export function DeleteButton({ kind, id }: { kind: "folder" | "list"; id: number }) {
  const { pending, error, run } = useAction();
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function onClick() {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
      return;
    }
    clearTimeout(timer.current);
    setArmed(false);
    run(() => (kind === "folder" ? deleteFolder(id) : deletePriceList(id)));
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={onClick} className="w-fit">
        <Trash2Icon /> {armed ? "Click again to delete" : `Delete ${kind === "folder" ? "folder" : "price list"}`}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

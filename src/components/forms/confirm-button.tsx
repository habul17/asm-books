"use client";

import { Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import type { FormState } from "./save-form";

const CONFIRM_MS = 4000;

/** Delete needs two clicks, so a slip of the finger never removes anything. */
export function ConfirmDeleteButton({ label, action }: { label: string; action: () => Promise<FormState> }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <span className="flex flex-col gap-1">
      <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={onClick}>
        <Trash2Icon /> {armed ? "Click again" : label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

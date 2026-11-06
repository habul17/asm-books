"use client";

import { useId, useState, useTransition } from "react";
import { cn } from "cn";

import { setManualPrice } from "@/app/(app)/price-lists/actions";
import { Input } from "@/components/ui/input";

/** A fixed price for one product; saved when the box loses focus or Enter is pressed. */
export function ManualPriceInput({
  listId,
  productId,
  partNo,
  value,
}: {
  listId: number;
  productId: number;
  partNo: string;
  value: number | null;
}) {
  const saved = value == null ? "" : String(value);
  const [text, setText] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errorId = useId();

  function save() {
    const next = text.trim();
    if (next === saved) {
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await setManualPrice(listId, productId, next);
      setError(result.error ?? null);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder="—"
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setText(saved);
            setError(null);
          }
        }}
        aria-label={`Manual price for ${partNo}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        aria-busy={pending}
        className={cn("h-8 w-24 text-right tabular-nums", pending && "opacity-60")}
      />
      {error && (
        <span id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

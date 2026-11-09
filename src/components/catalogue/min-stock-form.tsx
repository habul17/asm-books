"use client";

import { useId } from "react";

import { saveMinStock } from "@/app/(app)/catalogue/actions";
import { useSaveForm } from "@/components/forms/save-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Small inline box to set the stock level the Low Stock report warns at. */
export function MinStockForm({ productId, minStock, unit }: { productId: number; minStock: number | null; unit: string }) {
  const id = useId();
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveMinStock.bind(null, productId));
  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor={id} className="text-muted-foreground">
        Warn when stock falls to
      </label>
      <Input
        key={`${productId}-${minStock ?? ""}`}
        id={id}
        name="minStock"
        inputMode="decimal"
        defaultValue={minStock ?? ""}
        placeholder="—"
        maxLength={12}
        className="h-8 w-20"
      />
      <span className="text-muted-foreground">{unit}</span>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <span aria-live="polite">
        {state.error ? (
          <span className="text-destructive">{state.error}</span>
        ) : state.ok && !dirty && !pending ? (
          <span className="text-emerald-600 dark:text-emerald-400">Saved ✓</span>
        ) : null}
      </span>
    </form>
  );
}

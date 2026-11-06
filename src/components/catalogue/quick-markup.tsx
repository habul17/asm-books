"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { round2 } from "@/lib/pricing";

export function QuickMarkup({ purchasePrice }: { purchasePrice: number | null }) {
  const id = useId();
  const [pct, setPct] = useState("");
  const n = Number(pct);
  const price = pct !== "" && Number.isFinite(n) && purchasePrice != null ? round2(purchasePrice * (1 + n / 100)) : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor={id} className="text-muted-foreground">
        Quick markup
      </label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={0.5}
        placeholder="%"
        value={pct}
        onChange={(e) => setPct(e.target.value)}
        className="h-8 w-20"
      />
      <span className="text-muted-foreground">% =</span>
      <strong className="tabular-nums">{formatMoney(price)}</strong>
    </div>
  );
}

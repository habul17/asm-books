import { cn } from "cn";

import { formatMoney } from "@/lib/format";

/** "To receive ₹500" when the customer owes us; "To pay ₹200" when we owe them. */
export function Balance({ amount, className }: { amount: number; className?: string }) {
  if (Math.abs(amount) < 0.005) {
    return <span className={cn("text-muted-foreground", className)}>Settled</span>;
  }
  const owesUs = amount > 0;
  return (
    <span className={cn("tabular-nums", owesUs ? "text-foreground" : "text-emerald-700 dark:text-emerald-400", className)}>
      {owesUs ? "To receive " : "To pay "}
      {formatMoney(Math.abs(amount))}
    </span>
  );
}

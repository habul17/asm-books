import { cn } from "cn";

import { formatMoney } from "@/lib/format";

/** "To pay ₹500" when we owe the vendor; "To receive ₹200" when we paid them in advance. */
export function VendorBalance({ amount, className }: { amount: number; className?: string }) {
  if (Math.abs(amount) < 0.005) {
    return <span className={cn("text-muted-foreground", className)}>Settled</span>;
  }
  const weOwe = amount > 0;
  return (
    <span className={cn("tabular-nums", weOwe ? "text-foreground" : "text-emerald-700 dark:text-emerald-400", className)}>
      {weOwe ? "To pay " : "To receive "}
      {formatMoney(Math.abs(amount))}
    </span>
  );
}

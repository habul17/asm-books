import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { PAY_STATUS_LABELS, type BillPayment } from "@/lib/invoices/pay-status";

const VARIANT = { paid: "secondary", "part-paid": "outline", unpaid: "outline", overdue: "destructive" } as const;

/** Paid, partly paid, unpaid or overdue; `withDue` adds what is still to come. */
export function PayBadge({ pay, withDue = false }: { pay: BillPayment; withDue?: boolean }) {
  return (
    <Badge variant={VARIANT[pay.status]}>
      {PAY_STATUS_LABELS[pay.status]}
      {withDue && pay.status !== "paid" && <> · {formatMoney(pay.due)} due</>}
    </Badge>
  );
}

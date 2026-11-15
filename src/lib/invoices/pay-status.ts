// Whether each credit invoice is paid. Payments are taken against a customer, not a
// bill, so money received settles the oldest bill first (after any opening balance).

export type PayStatus = "paid" | "part-paid" | "unpaid" | "overdue";

export const PAY_STATUS_LABELS: Record<PayStatus, string> = {
  paid: "Paid",
  "part-paid": "Partly paid",
  unpaid: "Unpaid",
  overdue: "Overdue",
};

export interface CreditBill {
  id: number;
  date: string;
  dueDate: string | null;
  total: number;
}

export interface BillPayment {
  status: PayStatus;
  /** Settled so far. */
  paid: number;
  /** Still to come. */
  due: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * `received` is everything that counts as paid for this customer: payments plus returns
 * credited to their account. `opening` is the opening balance (positive: they owed us
 * before these bills; negative: money they paid in advance). Dates are YYYY-MM-DD.
 */
export function settleOldestFirst(
  bills: CreditBill[],
  received: number,
  opening: number,
  today: string,
): Map<number, BillPayment> {
  let left = round2(received - opening);
  const ordered = [...bills].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const out = new Map<number, BillPayment>();
  for (const b of ordered) {
    const paid = round2(Math.min(Math.max(left, 0), b.total));
    left = round2(left - paid);
    const due = round2(b.total - paid);
    const status: PayStatus =
      due <= 0
        ? "paid"
        : b.dueDate != null && b.dueDate < today
          ? "overdue"
          : paid > 0
            ? "part-paid"
            : "unpaid";
    out.set(b.id, { status, paid, due });
  }
  return out;
}

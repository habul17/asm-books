import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { getDb } from "@/db";
import { creditNotes, customers, invoiceLines, invoices, payments } from "@/db/schema";
import { paymentProfits, type PaymentProfit } from "@/lib/payments/profit";

type Db = ReturnType<typeof getDb>;

export interface PaymentSettled extends PaymentProfit {
  /** The invoices this payment settled, oldest first. */
  invoices: { id: number; number: string; date: string }[];
}

/**
 * For each final payment of these customers: the credit invoices the money settled
 * (oldest first) and the profit that brought in. Profit is owner data: callers must check.
 */
export async function loadPaymentProfits(db: Db, customerIds: number[]): Promise<Map<number, PaymentSettled>> {
  const ids = [...new Set(customerIds)];
  if (!ids.length) return new Map();

  const [bills, paid, credited, opening] = await db.batch([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        customerId: invoices.customerId,
        date: invoices.date,
        total: invoices.grandTotal,
        // Null when any row has no purchase cost: profit is then not known.
        profit: sql<number | null>`case when bool_and(${invoiceLines.cost} is not null)
          then ${invoices.taxableTotal} - sum(${invoiceLines.cost} * ${invoiceLines.qty}) end`.mapWith((v) =>
          v == null ? null : Number(v),
        ),
      })
      .from(invoices)
      .innerJoin(invoiceLines, eq(invoiceLines.invoiceId, invoices.id))
      .where(and(eq(invoices.status, "final"), eq(invoices.paymentType, "credit"), inArray(invoices.customerId, ids)))
      .groupBy(invoices.id),
    db
      .select({ id: payments.id, customerId: payments.customerId, date: payments.date, amount: payments.amount })
      .from(payments)
      .where(and(eq(payments.status, "final"), inArray(payments.customerId, ids))),
    db
      .select({ id: creditNotes.id, customerId: creditNotes.customerId, date: creditNotes.date, amount: creditNotes.grandTotal })
      .from(creditNotes)
      .where(and(eq(creditNotes.status, "final"), eq(creditNotes.refundType, "credit"), inArray(creditNotes.customerId, ids))),
    db.select({ id: customers.id, opening: customers.openingBalance }).from(customers).where(inArray(customers.id, ids)),
  ]);

  const byId = new Map(bills.map((b) => [b.id, b]));
  const out = new Map<number, PaymentSettled>();
  for (const { id: customerId, opening: open } of opening) {
    const receipts = [
      ...paid.filter((p) => p.customerId === customerId).map((p) => ({ paymentId: p.id, date: p.date, order: p.id * 2, amount: p.amount })),
      // A return credited on the same day settles before that day's payments.
      ...credited
        .filter((c) => c.customerId === customerId)
        .map((c) => ({ paymentId: null, date: c.date, order: -1, amount: c.amount })),
    ];
    const mine = bills.filter((b) => b.customerId === customerId);
    for (const [id, p] of paymentProfits(mine, receipts, open)) {
      const settled = p.bills.map((b) => byId.get(b.id)!).map((b) => ({ id: b.id, number: b.number, date: b.date }));
      out.set(id, { ...p, invoices: settled });
    }
  }
  return out;
}

import "server-only";

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";

import type { getDb } from "@/db";
import { creditNotes, customers, invoices, payments } from "@/db/schema";
import { settleOldestFirst, type BillPayment, type PayStatus } from "@/lib/invoices/pay-status";

type Db = ReturnType<typeof getDb>;

const todayInIndia = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * Paid, partly paid, unpaid or overdue for every active credit invoice of these
 * customers (all customers when `customerIds` is null). Cash invoices are paid at the
 * counter and cancelled ones owe nothing, so they are not in the map.
 */
export async function loadPayStatus(db: Db, customerIds: number[] | null): Promise<Map<number, BillPayment>> {
  const ids = customerIds && [...new Set(customerIds)];
  if (ids && !ids.length) return new Map();
  const only = (column: Parameters<typeof inArray>[0]): SQL | undefined => (ids ? inArray(column, ids) : undefined);

  const [bills, paid, credited, opening] = await db.batch([
    db
      .select({
        id: invoices.id,
        customerId: invoices.customerId,
        date: invoices.date,
        dueDate: invoices.dueDate,
        total: invoices.grandTotal,
      })
      .from(invoices)
      .where(and(eq(invoices.status, "final"), eq(invoices.paymentType, "credit"), only(invoices.customerId))),
    db
      .select({ customerId: payments.customerId, amount: sql<number>`sum(${payments.amount})`.mapWith(Number) })
      .from(payments)
      .where(and(eq(payments.status, "final"), only(payments.customerId)))
      .groupBy(payments.customerId),
    db
      .select({ customerId: creditNotes.customerId, amount: sql<number>`sum(${creditNotes.grandTotal})`.mapWith(Number) })
      .from(creditNotes)
      .where(and(eq(creditNotes.status, "final"), eq(creditNotes.refundType, "credit"), only(creditNotes.customerId)))
      .groupBy(creditNotes.customerId),
    db
      .select({ id: customers.id, opening: customers.openingBalance })
      .from(customers)
      .where(only(customers.id)),
  ]);

  const received = new Map<number, number>();
  for (const r of [...paid, ...credited]) {
    if (r.customerId != null) received.set(r.customerId, (received.get(r.customerId) ?? 0) + r.amount);
  }
  const openingOf = new Map(opening.map((c) => [c.id, c.opening]));
  const byCustomer = Map.groupBy(
    bills.filter((b) => b.customerId != null),
    (b) => b.customerId!,
  );

  const today = todayInIndia();
  const out = new Map<number, BillPayment>();
  for (const [customerId, list] of byCustomer) {
    const settled = settleOldestFirst(list, received.get(customerId) ?? 0, openingOf.get(customerId) ?? 0, today);
    for (const [id, s] of settled) out.set(id, s);
  }
  return out;
}

/** Invoice ids whose payment status is one of `wanted`. */
export async function invoicesWithPayStatus(db: Db, wanted: PayStatus[]): Promise<number[]> {
  const all = await loadPayStatus(db, null);
  return [...all].filter(([, s]) => wanted.includes(s.status)).map(([id]) => id);
}

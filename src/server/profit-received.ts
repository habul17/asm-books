import "server-only";

import { and, between, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { creditNoteLines, creditNotes, invoiceLines, invoices, payments } from "@/db/schema";
import { periodMonths, type Period } from "@/lib/reports/period";

import { loadPaymentProfits } from "./payment-profit";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ReceivedFigures {
  /** Cash sales less cash refunded for returns. */
  cashSales: number;
  /** Payments received from customers. */
  payments: number;
  /** All the money that came in: cash sales and payments. */
  received: number;
  /** Profit before GST in the money received. */
  profit: number;
  /** Money whose profit is not known: old dues, advances, parts without a purchase cost. */
  untraced: number;
}

export interface MonthReceived extends ReceivedFigures {
  /** YYYY-MM */
  month: string;
  /** The part of the period that falls in this month. */
  from: string;
  to: string;
}

interface Sums {
  cash: number;
  payments: number;
  profit: number;
  untraced: number;
}

const figures = (s: Sums): ReceivedFigures => ({
  cashSales: round2(s.cash),
  payments: round2(s.payments),
  received: round2(round2(s.cash) + round2(s.payments)),
  profit: round2(s.profit),
  untraced: round2(Math.max(s.untraced, 0)),
});

/**
 * Profit from the money that actually came in during a period: cash sales, less cash
 * refunded for returns, plus the profit each payment received carried (payments settle
 * the oldest credit bills first). Money for old dues, advances or bills without a
 * purchase cost carries no known profit and is reported as `untraced`.
 * In total, and for each month of the period. No auth check: callers must check for the owner.
 */
export async function profitReceived(p: Period): Promise<{ total: ReceivedFigures; months: MonthReceived[] }> {
  const db = getDb();
  const inPeriod = (date: typeof invoices.date | typeof creditNotes.date | typeof payments.date) =>
    between(date, p.from, p.to);
  const [cashSales, cashRefunds, paid] = await db.batch([
    db
      .select({
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
      .where(and(eq(invoices.status, "final"), eq(invoices.paymentType, "cash"), inPeriod(invoices.date)))
      .groupBy(invoices.id),
    db
      .select({
        date: creditNotes.date,
        total: creditNotes.grandTotal,
        // Profit given back: the sale value refunded, less the cost of parts put back on the shelf.
        profit: sql<number | null>`case when not ${creditNotes.restocked} then ${creditNotes.taxableTotal}
          when bool_and(${creditNoteLines.cost} is not null)
          then ${creditNotes.taxableTotal} - sum(${creditNoteLines.cost} * ${creditNoteLines.qty}) end`.mapWith((v) =>
          v == null ? null : Number(v),
        ),
      })
      .from(creditNotes)
      .innerJoin(creditNoteLines, eq(creditNoteLines.creditNoteId, creditNotes.id))
      .where(and(eq(creditNotes.status, "final"), eq(creditNotes.refundType, "cash"), inPeriod(creditNotes.date)))
      .groupBy(creditNotes.id),
    db
      .select({ id: payments.id, date: payments.date, customerId: payments.customerId, amount: payments.amount })
      .from(payments)
      .where(and(eq(payments.status, "final"), inPeriod(payments.date))),
  ]);
  const settled = await loadPaymentProfits(
    db,
    paid.map((r) => r.customerId),
  );

  const total: Sums = { cash: 0, payments: 0, profit: 0, untraced: 0 };
  const byMonth = new Map<string, Sums>();
  const add = (date: string, part: Partial<Sums>) => {
    const key = date.slice(0, 7);
    const month = byMonth.get(key) ?? { cash: 0, payments: 0, profit: 0, untraced: 0 };
    byMonth.set(key, month);
    for (const sums of [total, month]) {
      sums.cash += part.cash ?? 0;
      sums.payments += part.payments ?? 0;
      sums.profit += part.profit ?? 0;
      sums.untraced += part.untraced ?? 0;
    }
  };
  for (const s of cashSales) add(s.date, s.profit == null ? { cash: s.total, untraced: s.total } : { cash: s.total, profit: s.profit });
  for (const r of cashRefunds) {
    add(r.date, r.profit == null ? { cash: -r.total, untraced: -r.total } : { cash: -r.total, profit: -r.profit });
  }
  for (const r of paid) {
    const s = settled.get(r.id);
    add(r.date, s ? { payments: r.amount, profit: s.profit, untraced: s.untraced } : { payments: r.amount, untraced: r.amount });
  }

  const none: Sums = { cash: 0, payments: 0, profit: 0, untraced: 0 };
  return {
    total: figures(total),
    months: periodMonths(p.from, p.to).map((m) => ({ ...m, ...figures(byMonth.get(m.month) ?? none) })),
  };
}

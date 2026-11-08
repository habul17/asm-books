import "server-only";

import { eq, sql } from "drizzle-orm";

import { withTransaction, type Tx } from "@/db";
import { expenses } from "@/db/schema";
import type { ExpenseInput } from "@/lib/expenses/validation";
import { financialYear, invoiceNumber } from "@/lib/invoices/math";
import { loadBusiness } from "@/server/settings";

/** A problem with what the user entered; the message is safe to show. */
export class ExpenseInputError extends Error {}

/** Key for the lock that hands out expense numbers one at a time. */
const EXPENSE_NUMBER_LOCK = 72_810_005;

const columns = (input: ExpenseInput) => ({
  date: input.date,
  category: input.category,
  paidTo: input.paidTo || null,
  amount: input.amount,
  mode: input.mode,
  reference: input.reference || null,
  notes: input.notes || null,
});

export async function createExpense(input: ExpenseInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    const { expensePrefix } = await loadBusiness(tx);
    const fy = financialYear(input.date);
    // One number at a time, so two people saving together never get the same number.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${EXPENSE_NUMBER_LOCK})`);
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${expenses.seq}), 0) + 1`.mapWith(Number) })
      .from(expenses)
      .where(eq(expenses.fy, fy));
    const [{ id }] = await tx
      .insert(expenses)
      .values({ ...columns(input), number: invoiceNumber(expensePrefix, fy, next), fy, seq: next, createdBy: userId })
      .returning({ id: expenses.id });
    return id;
  });
}

async function lockExpense(tx: Tx, id: number) {
  const [row] = await tx
    .select({ id: expenses.id, fy: expenses.fy, status: expenses.status })
    .from(expenses)
    .where(eq(expenses.id, id))
    .for("update");
  if (!row) throw new ExpenseInputError("Expense not found.");
  if (row.status === "cancelled") throw new ExpenseInputError("This expense is cancelled and cannot be changed.");
  return row;
}

export async function updateExpense(id: number, input: ExpenseInput): Promise<void> {
  await withTransaction(async (tx) => {
    const existing = await lockExpense(tx, id);
    if (financialYear(input.date) !== existing.fy) {
      throw new ExpenseInputError(`This expense belongs to the year ${existing.fy}. Keep the date inside that year.`);
    }
    await tx.update(expenses).set(columns(input)).where(eq(expenses.id, id));
  });
}

export async function cancelExpense(id: number, reason: string): Promise<void> {
  await withTransaction(async (tx) => {
    await lockExpense(tx, id);
    await tx
      .update(expenses)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
      .where(eq(expenses.id, id));
  });
}

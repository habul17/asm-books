import "server-only";

import { eq, sql } from "drizzle-orm";

import { withTransaction, type Tx } from "@/db";
import { customers, payments } from "@/db/schema";
import { financialYear, invoiceNumber } from "@/lib/invoices/math";
import type { PaymentInput } from "@/lib/payments/validation";
import { loadBusiness } from "@/server/settings";
import { canChangeToday, staffEditLimit } from "@/lib/edit-window";

/** A problem with what the user entered; the message is safe to show. */
export class PaymentInputError extends Error {}

/** Key for the lock that hands out receipt numbers one at a time. */
const RECEIPT_NUMBER_LOCK = 72_810_002;

/** Switched-off customers can still pay what they owe, so any saved customer is accepted. */
async function checkCustomer(tx: Tx, customerId: number) {
  const [row] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId));
  if (!row) throw new PaymentInputError("Customer not found. Please choose again.");
}

const columns = (input: PaymentInput) => ({
  date: input.date,
  customerId: input.customerId,
  amount: input.amount,
  mode: input.mode,
  reference: input.reference || null,
  notes: input.notes || null,
});

export async function createPayment(input: PaymentInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    await checkCustomer(tx, input.customerId);
    const { receiptPrefix } = await loadBusiness(tx);
    const fy = financialYear(input.date);
    // One receipt number at a time, so two people saving together never get the same number.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${RECEIPT_NUMBER_LOCK})`);
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${payments.seq}), 0) + 1`.mapWith(Number) })
      .from(payments)
      .where(eq(payments.fy, fy));
    const [{ id }] = await tx
      .insert(payments)
      .values({ ...columns(input), number: invoiceNumber(receiptPrefix, fy, next), fy, seq: next, createdBy: userId })
      .returning({ id: payments.id });
    return id;
  });
}

async function lockPayment(tx: Tx, id: number) {
  const [row] = await tx
    .select({ id: payments.id, fy: payments.fy, status: payments.status, createdAt: payments.createdAt })
    .from(payments)
    .where(eq(payments.id, id))
    .for("update");
  if (!row) throw new PaymentInputError("Payment not found.");
  if (row.status === "cancelled") throw new PaymentInputError("This payment is cancelled and cannot be changed.");
  return row;
}

export async function updatePayment(id: number, input: PaymentInput, { isOwner }: { isOwner: boolean }): Promise<void> {
  await withTransaction(async (tx) => {
    const existing = await lockPayment(tx, id);
    if (!canChangeToday(isOwner, existing.createdAt)) throw new PaymentInputError(staffEditLimit("payments"));
    if (financialYear(input.date) !== existing.fy) {
      throw new PaymentInputError(`This receipt belongs to the year ${existing.fy}. Keep the date inside that year.`);
    }
    await checkCustomer(tx, input.customerId);
    await tx
      .update(payments)
      .set(columns(input))
      .where(eq(payments.id, id));
  });
}

export async function cancelPayment(id: number, reason: string): Promise<void> {
  await withTransaction(async (tx) => {
    await lockPayment(tx, id);
    await tx
      .update(payments)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
      .where(eq(payments.id, id));
  });
}

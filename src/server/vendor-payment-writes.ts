import "server-only";

import { eq, sql } from "drizzle-orm";

import { withTransaction, type Tx } from "@/db";
import { vendorPayments, vendors } from "@/db/schema";
import { financialYear, invoiceNumber } from "@/lib/invoices/math";
import type { VendorPaymentInput } from "@/lib/payments/validation";
import { loadBusiness } from "@/server/settings";

/** A problem with what the user entered; the message is safe to show. */
export class VendorPaymentInputError extends Error {}

/** Key for the lock that hands out payment-made numbers one at a time. */
const VENDOR_PAYMENT_NUMBER_LOCK = 72_810_004;

/** Switched-off vendors can still be paid what we owe, so any saved vendor is accepted. */
async function checkVendor(tx: Tx, vendorId: number) {
  const [row] = await tx.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, vendorId));
  if (!row) throw new VendorPaymentInputError("Vendor not found. Please choose again.");
}

const columns = (input: VendorPaymentInput) => ({
  date: input.date,
  vendorId: input.vendorId,
  amount: input.amount,
  mode: input.mode,
  reference: input.reference || null,
  notes: input.notes || null,
});

export async function createVendorPayment(input: VendorPaymentInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    await checkVendor(tx, input.vendorId);
    const { vendorPaymentPrefix } = await loadBusiness(tx);
    const fy = financialYear(input.date);
    // One number at a time, so two people saving together never get the same number.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${VENDOR_PAYMENT_NUMBER_LOCK})`);
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${vendorPayments.seq}), 0) + 1`.mapWith(Number) })
      .from(vendorPayments)
      .where(eq(vendorPayments.fy, fy));
    const [{ id }] = await tx
      .insert(vendorPayments)
      .values({
        ...columns(input),
        number: invoiceNumber(vendorPaymentPrefix, fy, next),
        fy,
        seq: next,
        createdBy: userId,
      })
      .returning({ id: vendorPayments.id });
    return id;
  });
}

async function lockVendorPayment(tx: Tx, id: number) {
  const [row] = await tx
    .select({ id: vendorPayments.id, fy: vendorPayments.fy, status: vendorPayments.status })
    .from(vendorPayments)
    .where(eq(vendorPayments.id, id))
    .for("update");
  if (!row) throw new VendorPaymentInputError("Payment not found.");
  if (row.status === "cancelled") throw new VendorPaymentInputError("This payment is cancelled and cannot be changed.");
  return row;
}

export async function updateVendorPayment(id: number, input: VendorPaymentInput): Promise<void> {
  await withTransaction(async (tx) => {
    const existing = await lockVendorPayment(tx, id);
    if (financialYear(input.date) !== existing.fy) {
      throw new VendorPaymentInputError(`This payment belongs to the year ${existing.fy}. Keep the date inside that year.`);
    }
    await checkVendor(tx, input.vendorId);
    await tx.update(vendorPayments).set(columns(input)).where(eq(vendorPayments.id, id));
  });
}

export async function cancelVendorPayment(id: number, reason: string): Promise<void> {
  await withTransaction(async (tx) => {
    await lockVendorPayment(tx, id);
    await tx
      .update(vendorPayments)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
      .where(eq(vendorPayments.id, id));
  });
}

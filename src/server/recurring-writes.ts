import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDb, withTransaction, type Tx } from "@/db";
import { invoices, recurringInvoices } from "@/db/schema";
import { advance, dayOf, type RecurringInput } from "@/lib/recurring/schedule";

// Kept apart from the reads so that saving an invoice can call
// `recordRecurringInvoice` without the two modules importing each other.

/** A problem with what the user entered; the message is safe to show. */
export class RecurringError extends Error {}

/** Starts repeating an invoice. No auth check: the action has checked the user. */
export async function createRecurring(input: RecurringInput, userId: number): Promise<number> {
  const db = getDb();
  const [inv] = await db
    .select({ customerId: invoices.customerId, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, input.invoiceId));
  if (!inv) throw new RecurringError("Invoice not found.");
  if (inv.status !== "final") throw new RecurringError("A cancelled invoice cannot be repeated.");
  if (inv.customerId == null) throw new RecurringError("A walk-in invoice cannot be repeated. Save the customer first.");
  const [{ id }] = await db
    .insert(recurringInvoices)
    .values({
      invoiceId: input.invoiceId,
      customerId: inv.customerId,
      frequency: input.frequency,
      anchorDay: dayOf(input.nextDate),
      nextDate: input.nextDate,
      endDate: input.endDate,
      notes: input.notes || null,
      createdBy: userId,
    })
    .returning({ id: recurringInvoices.id });
  return id;
}

async function lockRecurring(tx: Tx, id: number) {
  const [row] = await tx
    .select({
      id: recurringInvoices.id,
      frequency: recurringInvoices.frequency,
      anchorDay: recurringInvoices.anchorDay,
      nextDate: recurringInvoices.nextDate,
      endDate: recurringInvoices.endDate,
      active: recurringInvoices.active,
    })
    .from(recurringInvoices)
    .where(eq(recurringInvoices.id, id))
    .for("update");
  return row ?? null;
}

/**
 * Called while an invoice made for a recurring invoice is being saved: counts
 * it and moves on to the next date. A recurring invoice that was stopped or
 * removed meanwhile is left alone; the invoice is still saved.
 */
export async function recordRecurringInvoice(tx: Tx, id: number, invoiceId: number): Promise<void> {
  const row = await lockRecurring(tx, id);
  if (!row || !row.active) return;
  await tx
    .update(recurringInvoices)
    .set({ ...advance(row), lastInvoiceId: invoiceId, made: sql`${recurringInvoices.made} + 1` })
    .where(eq(recurringInvoices.id, id));
}

/** Leaves out the invoice that is due and moves on to the next date. */
export async function skipRecurring(id: number): Promise<void> {
  await withTransaction(async (tx) => {
    const row = await lockRecurring(tx, id);
    if (!row) throw new RecurringError("Recurring invoice not found.");
    if (!row.active) throw new RecurringError("This recurring invoice is stopped.");
    await tx.update(recurringInvoices).set(advance(row)).where(eq(recurringInvoices.id, id));
  });
}

/** Stops a recurring invoice, or starts it again. Starting again never leaves a date in the past waiting. */
export async function setRecurringActive(id: number, active: boolean, today: string): Promise<void> {
  await withTransaction(async (tx) => {
    const row = await lockRecurring(tx, id);
    if (!row) throw new RecurringError("Recurring invoice not found.");
    if (!active) {
      await tx.update(recurringInvoices).set({ active: false }).where(eq(recurringInvoices.id, id));
      return;
    }
    let next = { nextDate: row.nextDate, active: true };
    // Dates missed while it was stopped are not billed late.
    for (let i = 0; i < 1000 && next.active && next.nextDate < today; i++) next = advance({ ...row, nextDate: next.nextDate });
    if (!next.active || (row.endDate != null && next.nextDate > row.endDate)) {
      throw new RecurringError("Its end date has passed, so it cannot start again. Repeat the invoice afresh instead.");
    }
    await tx.update(recurringInvoices).set({ active: true, nextDate: next.nextDate }).where(eq(recurringInvoices.id, id));
  });
}

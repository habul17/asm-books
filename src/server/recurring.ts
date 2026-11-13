import "server-only";

import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { connection } from "next/server";

import { getDb, withTransaction, type Tx } from "@/db";
import { customers, invoices, recurringInvoices } from "@/db/schema";
import { advance, dayOf, type RecurringInput } from "@/lib/recurring/schedule";
import { requireUser } from "@/server/auth";

import { todayInIndia } from "./invoice-writes";

/** A problem with what the user entered; the message is safe to show. */
export class RecurringError extends Error {}

/** The invoice made most recently for a recurring invoice. */
const lastInvoices = alias(invoices, "last_invoices");

/** Due now: active, the next date has come, and it is not past the end date. */
const dueWhere = (today: string) =>
  and(
    eq(recurringInvoices.active, true),
    lte(recurringInvoices.nextDate, today),
    or(isNull(recurringInvoices.endDate), lte(recurringInvoices.nextDate, recurringInvoices.endDate)),
  );

const columns = {
  id: recurringInvoices.id,
  invoiceId: recurringInvoices.invoiceId,
  invoiceNumber: invoices.number,
  grandTotal: invoices.grandTotal,
  customerId: recurringInvoices.customerId,
  customerName: customers.name,
  frequency: recurringInvoices.frequency,
  nextDate: recurringInvoices.nextDate,
  endDate: recurringInvoices.endDate,
  active: recurringInvoices.active,
  made: recurringInvoices.made,
  lastInvoiceId: recurringInvoices.lastInvoiceId,
  lastInvoiceNumber: lastInvoices.number,
  notes: recurringInvoices.notes,
};

/** Every recurring invoice: the ones still running first, the soonest due on top. */
export async function listRecurring() {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const today = todayInIndia();
  const rows = await getDb()
    .select(columns)
    .from(recurringInvoices)
    .innerJoin(invoices, eq(invoices.id, recurringInvoices.invoiceId))
    .innerJoin(customers, eq(customers.id, recurringInvoices.customerId))
    .leftJoin(lastInvoices, eq(lastInvoices.id, recurringInvoices.lastInvoiceId))
    .orderBy(desc(recurringInvoices.active), asc(recurringInvoices.nextDate), asc(recurringInvoices.id))
    .limit(500);
  return { today, items: rows };
}

export type RecurringItem = Awaited<ReturnType<typeof listRecurring>>["items"][number];

/** Recurring invoices that should be made now. No auth check: callers have checked the user. */
export async function loadDueRecurring(today: string) {
  return getDb()
    .select({
      id: recurringInvoices.id,
      customerName: customers.name,
      grandTotal: invoices.grandTotal,
      nextDate: recurringInvoices.nextDate,
    })
    .from(recurringInvoices)
    .innerJoin(invoices, eq(invoices.id, recurringInvoices.invoiceId))
    .innerJoin(customers, eq(customers.id, recurringInvoices.customerId))
    .where(dueWhere(today))
    .orderBy(asc(recurringInvoices.nextDate), asc(recurringInvoices.id))
    .limit(100);
}

/** One recurring invoice that is still running, to start a new invoice from it. */
export async function getActiveRecurring(id: number) {
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb()
    .select({ id: recurringInvoices.id, invoiceId: recurringInvoices.invoiceId })
    .from(recurringInvoices)
    .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.active, true)));
  return row ?? null;
}

/** The invoice a new recurring invoice would repeat, for the form. */
export async function getRepeatSource(invoiceId: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) return null;
  const [row] = await getDb()
    .select({
      id: invoices.id,
      number: invoices.number,
      date: invoices.date,
      customerId: invoices.customerId,
      customerName: invoices.customerName,
      grandTotal: invoices.grandTotal,
      status: invoices.status,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId));
  return row ?? null;
}

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
export async function setRecurringActive(id: number, active: boolean): Promise<void> {
  await withTransaction(async (tx) => {
    const row = await lockRecurring(tx, id);
    if (!row) throw new RecurringError("Recurring invoice not found.");
    if (!active) {
      await tx.update(recurringInvoices).set({ active: false }).where(eq(recurringInvoices.id, id));
      return;
    }
    const today = todayInIndia();
    let next = { nextDate: row.nextDate, active: true };
    // Dates missed while it was stopped are not billed late.
    for (let i = 0; i < 1000 && next.active && next.nextDate < today; i++) next = advance({ ...row, nextDate: next.nextDate });
    if (!next.active || (row.endDate != null && next.nextDate > row.endDate)) {
      throw new RecurringError("Its end date has passed, so it cannot start again. Repeat the invoice afresh instead.");
    }
    await tx.update(recurringInvoices).set({ active: true, nextDate: next.nextDate }).where(eq(recurringInvoices.id, id));
  });
}

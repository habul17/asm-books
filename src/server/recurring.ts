import "server-only";

import { and, asc, desc, eq, isNull, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { connection } from "next/server";

import { getDb } from "@/db";
import { customers, invoices, recurringInvoices } from "@/db/schema";
import { requireUser } from "@/server/auth";

import { todayInIndia } from "./invoice-writes";

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

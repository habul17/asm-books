import "server-only";

import { and, asc, desc, eq, getTableColumns, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { creditNoteLines, creditNotes, customers, invoiceLines, invoices, users } from "@/db/schema";
import { requireUser } from "@/server/auth";

import { returnedQty } from "./credit-note-writes";
import { customerBalance } from "./customers";

export const CREDIT_NOTE_LIMIT = 100;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type CreditNoteStatusFilter = "all" | "final" | "cancelled";

export interface CreditNoteFilters {
  query: string;
  status: CreditNoteStatusFilter;
  customerId: number | null;
  invoiceId?: number | null;
}

/** Every word must appear in the credit note number, invoice number, customer name or mobile. */
export async function searchCreditNotes(filters: CreditNoteFilters, limit = CREDIT_NOTE_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [
    filters.status === "all" ? undefined : eq(creditNotes.status, filters.status),
    filters.customerId ? eq(creditNotes.customerId, filters.customerId) : undefined,
    filters.invoiceId ? eq(creditNotes.invoiceId, filters.invoiceId) : undefined,
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(
        ilike(creditNotes.number, like),
        ilike(invoices.number, like),
        ilike(creditNotes.customerName, like),
        ilike(creditNotes.customerMobile, like),
      ),
    );
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        total: sql<number>`coalesce(sum(${creditNotes.grandTotal}) FILTER (WHERE ${creditNotes.status} = 'final'), 0)`.mapWith(
          Number,
        ),
      })
      .from(creditNotes)
      .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
      .where(where),
    db
      .select({
        id: creditNotes.id,
        number: creditNotes.number,
        date: creditNotes.date,
        invoiceNumber: invoices.number,
        customerName: creditNotes.customerName,
        refundType: creditNotes.refundType,
        grandTotal: creditNotes.grandTotal,
        status: creditNotes.status,
      })
      .from(creditNotes)
      .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
      .where(where)
      .orderBy(desc(creditNotes.date), desc(creditNotes.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, total: summary[0]?.total ?? 0, items };
}

export type CreditNoteListItem = Awaited<ReturnType<typeof searchCreditNotes>>["items"][number];

/** Line columns without the purchase cost, which never leaves the server. */
const lineColumns = Object.fromEntries(
  Object.entries(getTableColumns(creditNoteLines)).filter(([key]) => key !== "cost"),
) as Omit<ReturnType<typeof getTableColumns<typeof creditNoteLines>>, "cost">;

/** One credit note with its lines, the invoice it came from and the customer's balance now. */
export async function getCreditNote(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = getDb();
  const [heads, lines] = await db.batch([
    db
      .select({
        note: creditNotes,
        invoiceNumber: invoices.number,
        invoiceDate: invoices.date,
        createdByName: users.name,
        balanceNow: customerBalance,
      })
      .from(creditNotes)
      .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
      .leftJoin(customers, eq(customers.id, creditNotes.customerId))
      .leftJoin(users, eq(users.id, creditNotes.createdBy))
      .where(eq(creditNotes.id, id)),
    db.select(lineColumns).from(creditNoteLines).where(eq(creditNoteLines.creditNoteId, id)).orderBy(asc(creditNoteLines.lineNo)),
  ]);
  const head = heads[0];
  if (!head) return null;
  return {
    ...head.note,
    invoiceNumber: head.invoiceNumber,
    invoiceDate: head.invoiceDate,
    createdByName: head.createdByName,
    balanceNow: head.note.customerId == null ? null : head.balanceNow,
    lines,
  };
}

export type CreditNoteDetail = NonNullable<Awaited<ReturnType<typeof getCreditNote>>>;

/** An invoice and how much of each line can still be returned, for the return form. */
export async function getReturnable(invoiceId: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) return null;
  const db = getDb();
  const [heads, lines] = await db.batch([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        date: invoices.date,
        status: invoices.status,
        customerId: invoices.customerId,
        customerName: invoices.customerName,
        paymentType: invoices.paymentType,
        taxType: invoices.taxType,
      })
      .from(invoices)
      .where(eq(invoices.id, invoiceId)),
    db
      .select({
        id: invoiceLines.id,
        partNo: invoiceLines.partNo,
        description: invoiceLines.description,
        unit: invoiceLines.unit,
        qty: invoiceLines.qty,
        rate: invoiceLines.rate,
        discountPct: invoiceLines.discountPct,
        gstRate: invoiceLines.gstRate,
        returned: returnedQty,
      })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .orderBy(asc(invoiceLines.lineNo)),
  ]);
  const head = heads[0];
  if (!head) return null;
  return {
    ...head,
    lines: lines.map((l) => ({ ...l, left: Math.max(0, Math.round((l.qty - l.returned) * 1000) / 1000) })),
  };
}

export type Returnable = NonNullable<Awaited<ReturnType<typeof getReturnable>>>;

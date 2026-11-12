import "server-only";

import { and, asc, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { connection } from "next/server";

import { getDb } from "@/db";
import { invoices, salesDocLines, salesDocs, users } from "@/db/schema";
import type { SalesDocKind, SalesDocStatus } from "@/lib/sales-docs/kinds";
import { EWAY_BILL_LIMIT } from "@/lib/transport";
import { requireUser } from "@/server/auth";

export const SALES_DOC_LIMIT = 100;
const EWAY_LIMIT = 200;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface SalesDocFilters {
  query: string;
  status: SalesDocStatus | "all";
}

/** Every word must appear in the number, customer name or mobile. */
export async function searchSalesDocs(kind: SalesDocKind, filters: SalesDocFilters, limit = SALES_DOC_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [
    eq(salesDocs.kind, kind),
    filters.status === "all" ? undefined : eq(salesDocs.status, filters.status),
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(ilike(salesDocs.number, like), ilike(salesDocs.customerName, like), ilike(salesDocs.customerMobile, like)),
    );
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(salesDocs).where(where),
    db
      .select({
        id: salesDocs.id,
        number: salesDocs.number,
        date: salesDocs.date,
        customerName: salesDocs.customerName,
        grandTotal: salesDocs.grandTotal,
        status: salesDocs.status,
      })
      .from(salesDocs)
      .where(where)
      .orderBy(desc(salesDocs.date), desc(salesDocs.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, items };
}

const sourceDocs = alias(salesDocs, "source_docs");

/** One quote, order or challan with its lines and what it is linked to. */
export async function getSalesDoc(kind: SalesDocKind, id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = getDb();
  const [heads, lines, made] = await db.batch([
    db
      .select({
        doc: salesDocs,
        createdByName: users.name,
        invoiceNumber: invoices.number,
        sourceKind: sourceDocs.kind,
        sourceNumber: sourceDocs.number,
      })
      .from(salesDocs)
      .leftJoin(users, eq(users.id, salesDocs.createdBy))
      .leftJoin(invoices, eq(invoices.id, salesDocs.invoiceId))
      .leftJoin(sourceDocs, eq(sourceDocs.id, salesDocs.sourceId))
      .where(and(eq(salesDocs.id, id), eq(salesDocs.kind, kind))),
    db.select().from(salesDocLines).where(eq(salesDocLines.docId, id)).orderBy(asc(salesDocLines.lineNo)),
    // Documents made from this one, e.g. the challans of an order.
    db
      .select({ id: salesDocs.id, kind: salesDocs.kind, number: salesDocs.number, status: salesDocs.status })
      .from(salesDocs)
      .where(eq(salesDocs.sourceId, id))
      .orderBy(asc(salesDocs.id)),
  ]);
  const head = heads[0];
  if (!head) return null;
  return {
    ...head.doc,
    createdByName: head.createdByName,
    invoiceNumber: head.invoiceNumber,
    source:
      head.doc.sourceId != null && head.sourceKind && head.sourceNumber
        ? { id: head.doc.sourceId, kind: head.sourceKind, number: head.sourceNumber }
        : null,
    made,
    lines,
  };
}

export type SalesDocDetail = NonNullable<Awaited<ReturnType<typeof getSalesDoc>>>;

const ewayNo = (column: typeof invoices.transport | typeof salesDocs.transport) => sql<string | null>`${column}->>'ewayBillNo'`;
const ewayUntil = (column: typeof invoices.transport | typeof salesDocs.transport) =>
  sql<string | null>`${column}->>'ewayValidUntil'`;

/**
 * Invoices and delivery challans that have an e-way bill, or are large enough
 * to normally need one. Cancelled documents are left out.
 */
export async function listEwayBills() {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const db = getDb();
  const [invoiceRows, challanRows] = await db.batch([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        date: invoices.date,
        customerName: invoices.customerName,
        grandTotal: invoices.grandTotal,
        ewayBillNo: ewayNo(invoices.transport),
        ewayValidUntil: ewayUntil(invoices.transport),
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "final"),
          or(gte(invoices.grandTotal, EWAY_BILL_LIMIT), sql`${ewayNo(invoices.transport)} IS NOT NULL`),
        ),
      )
      .orderBy(desc(invoices.date), desc(invoices.id))
      .limit(EWAY_LIMIT),
    db
      .select({
        id: salesDocs.id,
        number: salesDocs.number,
        date: salesDocs.date,
        customerName: salesDocs.customerName,
        grandTotal: salesDocs.grandTotal,
        ewayBillNo: ewayNo(salesDocs.transport),
        ewayValidUntil: ewayUntil(salesDocs.transport),
      })
      .from(salesDocs)
      .where(
        and(
          eq(salesDocs.kind, "challan"),
          // A challan that became an invoice is covered by that invoice.
          sql`${salesDocs.status} <> 'cancelled' AND ${salesDocs.invoiceId} IS NULL`,
          or(gte(salesDocs.grandTotal, EWAY_BILL_LIMIT), sql`${ewayNo(salesDocs.transport)} IS NOT NULL`),
        ),
      )
      .orderBy(desc(salesDocs.date), desc(salesDocs.id))
      .limit(EWAY_LIMIT),
  ]);
  return [
    ...invoiceRows.map((r) => ({ ...r, type: "invoice" as const })),
    ...challanRows.map((r) => ({ ...r, type: "challan" as const })),
  ].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
}

export type EwayRow = Awaited<ReturnType<typeof listEwayBills>>[number];

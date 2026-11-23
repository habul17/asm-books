import "server-only";

import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { col } from "@/db/sql";
import { creditNoteLines, creditNotes, invoiceLines, invoices, products } from "@/db/schema";
import type { MovementInput, MovementPeriod } from "@/lib/stock/movement";
import { requireOwner } from "@/server/auth";

import { todayInIndia } from "./invoice-writes";

/** An ISO date moved by whole days. */
export function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * How much of each part sold in the last `days` days and in the same length of
 * time before that, less returns, beside its stock. Final bills only.
 */
export async function stockMovement(days: MovementPeriod) {
  await connection(); // Always read live data; never prerender at build time.
  await requireOwner();
  const today = todayInIndia();
  const from = shift(today, -(days - 1));
  const before = shift(from, -days);
  const db = getDb();
  const recent = sql`${invoices.date} >= ${from}`;
  const returnRecent = sql`${creditNotes.date} >= ${from}`;

  const [items, sold, returned] = await db.batch([
    db
      .select({
        id: products.id,
        partNo: products.partNo,
        description: products.description,
        unit: products.unit,
        photo: products.photo,
        stockQty: products.stockQty,
      })
      .from(products)
      .where(eq(products.active, true)),
    db
      .select({
        productId: invoiceLines.productId,
        sold: sql<number>`coalesce(sum(${invoiceLines.qty}) filter (where ${recent}), 0)`.mapWith(Number),
        soldBefore: sql<number>`coalesce(sum(${invoiceLines.qty}) filter (where not (${recent})), 0)`.mapWith(Number),
        bills: sql<number>`count(distinct ${invoices.id}) filter (where ${recent})`.mapWith(Number),
        customers: sql<number>`count(distinct ${invoices.customerId}) filter (where ${recent})`.mapWith(Number),
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(
        and(eq(invoices.status, "final"), isNotNull(invoiceLines.productId), gte(invoices.date, before), lte(invoices.date, today)),
      )
      .groupBy(invoiceLines.productId),
    db
      .select({
        productId: creditNoteLines.productId,
        qty: sql<number>`coalesce(sum(${creditNoteLines.qty}) filter (where ${returnRecent}), 0)`.mapWith(Number),
        qtyBefore: sql<number>`coalesce(sum(${creditNoteLines.qty}) filter (where not (${returnRecent})), 0)`.mapWith(Number),
      })
      .from(creditNoteLines)
      .innerJoin(creditNotes, eq(creditNotes.id, creditNoteLines.creditNoteId))
      .where(
        and(
          eq(creditNotes.status, "final"),
          isNotNull(creditNoteLines.productId),
          gte(creditNotes.date, before),
          lte(creditNotes.date, today),
        ),
      )
      .groupBy(creditNoteLines.productId),
  ]);

  const soldBy = new Map(sold.map((s) => [s.productId as number, s]));
  const returnedBy = new Map(returned.map((r) => [r.productId as number, r]));
  const q3 = (n: number) => Math.round(n * 1000) / 1000;
  const rows: MovementInput[] = items.map((p) => {
    const s = soldBy.get(p.id);
    const r = returnedBy.get(p.id);
    return {
      ...p,
      sold: q3((s?.sold ?? 0) - (r?.qty ?? 0)),
      soldBefore: q3((s?.soldBefore ?? 0) - (r?.qtyBefore ?? 0)),
      bills: s?.bills ?? 0,
      customers: s?.customers ?? 0,
    };
  });
  return { from, today, rows };
}

/**
 * How many of each part sold from `from` to `to` (final bills, less final
 * returns), as a sub-query on `products`.
 */
export function soldBetween(from: string, to: string) {
  return sql<number>`(
    (SELECT coalesce(sum(${col(invoiceLines.qty)}), 0) FROM ${invoiceLines}
      JOIN ${invoices} ON ${col(invoices.id)} = ${col(invoiceLines.invoiceId)}
      WHERE ${col(invoiceLines.productId)} = ${col(products.id)} AND ${col(invoices.status)} = 'final'
        AND ${col(invoices.date)} BETWEEN ${from} AND ${to})
    - (SELECT coalesce(sum(${col(creditNoteLines.qty)}), 0) FROM ${creditNoteLines}
      JOIN ${creditNotes} ON ${col(creditNotes.id)} = ${col(creditNoteLines.creditNoteId)}
      WHERE ${col(creditNoteLines.productId)} = ${col(products.id)} AND ${col(creditNotes.status)} = 'final'
        AND ${col(creditNotes.date)} BETWEEN ${from} AND ${to})
  )`.mapWith(Number);
}

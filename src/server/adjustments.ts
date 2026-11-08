import "server-only";

import { and, asc, desc, eq, exists, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { categories, products, stockAdjustmentLines, stockAdjustments, users } from "@/db/schema";
import { col } from "@/db/sql";
import { requireUser } from "@/server/auth";

import { productSearch } from "./product-search";

export const ADJUSTMENT_LIMIT = 100;
const PICK_LIMIT = 15;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type AdjustmentStatusFilter = "all" | "final" | "cancelled";

export interface AdjustmentFilters {
  query: string;
  status: AdjustmentStatusFilter;
}

/** Every word must appear in the number, reason or notes, or in a part number or description on it. */
export async function searchAdjustments(filters: AdjustmentFilters, limit = ADJUSTMENT_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const db = getDb();
  const conditions: (SQL | undefined)[] = [
    filters.status === "all" ? undefined : eq(stockAdjustments.status, filters.status),
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(
        ilike(stockAdjustments.number, like),
        ilike(stockAdjustments.reason, like),
        ilike(stockAdjustments.notes, like),
        exists(
          db
            .select({ one: sql`1` })
            .from(stockAdjustmentLines)
            .where(
              and(
                eq(col(stockAdjustmentLines.adjustmentId), col(stockAdjustments.id)),
                or(ilike(col(stockAdjustmentLines.partNo), like), ilike(col(stockAdjustmentLines.description), like)),
              ),
            ),
        ),
      ),
    );
  }
  const where = and(...conditions);
  const lineCount = sql<number>`(SELECT count(*) FROM ${stockAdjustmentLines} WHERE ${col(stockAdjustmentLines.adjustmentId)} = ${col(stockAdjustments.id)})`.mapWith(Number);
  const netQty = sql<number>`(SELECT coalesce(sum(${col(stockAdjustmentLines.qty)}), 0) FROM ${stockAdjustmentLines} WHERE ${col(stockAdjustmentLines.adjustmentId)} = ${col(stockAdjustments.id)})`.mapWith(Number);
  const [summary, items] = await db.batch([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(stockAdjustments).where(where),
    db
      .select({
        id: stockAdjustments.id,
        number: stockAdjustments.number,
        date: stockAdjustments.date,
        reason: stockAdjustments.reason,
        status: stockAdjustments.status,
        lineCount,
        netQty,
      })
      .from(stockAdjustments)
      .where(where)
      .orderBy(desc(stockAdjustments.date), desc(stockAdjustments.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, items };
}

export type AdjustmentListItem = Awaited<ReturnType<typeof searchAdjustments>>["items"][number];

/** One adjustment with its lines and who made it. */
export async function getAdjustment(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = getDb();
  const [heads, lines] = await db.batch([
    db
      .select({ adj: stockAdjustments, createdByName: users.name })
      .from(stockAdjustments)
      .leftJoin(users, eq(users.id, stockAdjustments.createdBy))
      .where(eq(stockAdjustments.id, id)),
    db
      .select({
        id: stockAdjustmentLines.id,
        productId: stockAdjustmentLines.productId,
        partNo: stockAdjustmentLines.partNo,
        description: stockAdjustmentLines.description,
        unit: stockAdjustmentLines.unit,
        qtyBefore: stockAdjustmentLines.qtyBefore,
        qty: stockAdjustmentLines.qty,
        cost: stockAdjustmentLines.cost,
        stockNow: products.stockQty,
      })
      .from(stockAdjustmentLines)
      .innerJoin(products, eq(products.id, stockAdjustmentLines.productId))
      .where(eq(stockAdjustmentLines.adjustmentId, id))
      .orderBy(asc(stockAdjustmentLines.lineNo)),
  ]);
  const head = heads[0];
  if (!head) return null;
  return { ...head.adj, createdByName: head.createdByName, lines };
}

export type AdjustmentDetail = NonNullable<Awaited<ReturnType<typeof getAdjustment>>>;

/** Parts matching the search, with the stock the app holds now. */
export async function pickStockItems(query: string) {
  await requireUser();
  const { where, rank } = productSearch(query);
  return getDb()
    .select({
      id: products.id,
      partNo: products.partNo,
      description: products.description,
      unit: products.unit,
      stockQty: products.stockQty,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(rank, asc(products.sort), asc(products.id))
    .limit(PICK_LIMIT);
}

export type StockItem = Awaited<ReturnType<typeof pickStockItems>>[number];

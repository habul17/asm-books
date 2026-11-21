import "server-only";

import { and, asc, eq, gt, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { products } from "@/db/schema";
import { lotsValue, type Lot } from "@/lib/stock/fifo";
import type { StockRow } from "@/lib/stock/filter";
import { isOwner, requireUser } from "@/server/auth";

import { loadStockLots } from "./fifo";

export interface StockCost {
  /** Pieces on hand by purchase bill, oldest first. */
  lots: Lot[];
  /** What those pieces actually cost: each bill's pieces at that bill's price. */
  value: number;
  /** Some pieces have no known price; they count as 0. */
  missingCost: boolean;
}

/**
 * The actual cost of the stock on hand for these parts, first in, first out: the
 * same batches that sales and profit use. Parts at or below zero cost nothing.
 * Callers check who is signed in.
 */
export async function stockCosts(productIds: number[]): Promise<Map<number, StockCost>> {
  const out = new Map<number, StockCost>();
  if (!productIds.length) return out;
  const lots = await loadStockLots(getDb(), productIds);
  for (const [id, l] of lots) out.set(id, { lots: l.lots, ...lotsValue(l.lots) });
  return out;
}

/** Ids of the active parts with stock on the shelf, optionally narrowed further. */
export async function inStockIds(where?: SQL): Promise<number[]> {
  const rows = await getDb()
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.active, true), gt(products.stockQty, 0), where));
  return rows.map((r) => r.id);
}

/**
 * Every active part with its stock, and for the owner what that stock actually
 * cost (each purchase bill's pieces at that bill's price).
 */
export async function stockOverview(): Promise<{ owner: boolean; items: StockRow[] }> {
  await connection(); // Always read live data; never prerender at build time.
  const owner = isOwner(await requireUser());
  const rows = await getDb()
    .select({
      id: products.id,
      partNo: products.partNo,
      description: products.description,
      unit: products.unit,
      photo: products.photo,
      stockQty: products.stockQty,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.partNo));
  const costs = owner ? await stockCosts(rows.filter((r) => r.stockQty > 0).map((r) => r.id)) : new Map<number, StockCost>();
  return {
    owner,
    items: rows.map((r) => {
      const c = costs.get(r.id);
      return {
        ...r,
        lots: owner ? (c?.lots ?? []).map((l) => ({ left: l.left, cost: l.cost })) : null,
        value: owner ? (c?.value ?? 0) : null,
        missingCost: c?.missingCost ?? false,
      };
    }),
  };
}

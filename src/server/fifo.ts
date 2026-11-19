import "server-only";

import { and, eq, inArray, notLike, sql } from "drizzle-orm";

import type { getDb, Tx } from "@/db";
import { billLines, bills, invoiceLineBatches, products, purchasePrices } from "@/db/schema";
import { lotsOnHand, newestCost, takeOldestFirst, unitCost, type Batch, type Lot, type Portion } from "@/lib/stock/fifo";

import { realPurchasePrice } from "./product-search";

type Db = ReturnType<typeof getDb> | Tx;

export interface StockLots {
  /** Pieces on hand by batch, oldest first. */
  lots: Lot[];
  /** Cost for pieces sold beyond the stock: the newest bill's. */
  shortCost: number | null;
}

/**
 * Every part's purchase bills (its batches) and stock, worked out first in, first out.
 * `addBack` adds pieces as if not sold yet, e.g. what an invoice being changed already took.
 * `lock` holds the parts' rows until the transaction ends, so two sales cannot take the same pieces.
 */
export async function loadStockLots(
  db: Db,
  productIds: number[],
  { addBack = new Map<number, number>(), lock = false }: { addBack?: Map<number, number>; lock?: boolean } = {},
): Promise<Map<number, StockLots>> {
  const ids = [...new Set(productIds)];
  if (!ids.length) return new Map();
  const stockQuery = db.select({ id: products.id, stock: products.stockQty }).from(products).where(inArray(products.id, ids)).orderBy(products.id);
  const [stockRows, batchRows, olderRows] = await Promise.all([
    lock ? stockQuery.for("update") : stockQuery,
    db
      .select({
        productId: billLines.productId,
        billId: bills.id,
        billNo: bills.billNo,
        date: bills.date,
        qty: billLines.qty,
        cost: sql<number>`${billLines.rate} * (1 - ${billLines.discountPct} / 100.0)`.mapWith(Number),
      })
      .from(billLines)
      .innerJoin(bills, eq(bills.id, billLines.billId))
      .where(and(inArray(billLines.productId, ids), eq(bills.status, "final"))),
    // The price known before any bill (typed in), for older stock; Excel placeholder prices do not count.
    db
      .selectDistinctOn([purchasePrices.productId], { productId: purchasePrices.productId, price: purchasePrices.price })
      .from(purchasePrices)
      .where(and(inArray(purchasePrices.productId, ids), notLike(purchasePrices.source, "bill:%"), realPurchasePrice))
      .orderBy(purchasePrices.productId, sql`${purchasePrices.date} DESC`, sql`${purchasePrices.id} DESC`),
  ]);
  const batches = new Map<number, Batch[]>();
  for (const r of batchRows) {
    if (r.productId == null) continue;
    const list = batches.get(r.productId) ?? [];
    list.push({ billId: r.billId, billNo: r.billNo, date: r.date, qty: r.qty, cost: r.cost });
    batches.set(r.productId, list);
  }
  const older = new Map(olderRows.map((r) => [r.productId, r.price]));
  const out = new Map<number, StockLots>();
  for (const s of stockRows) {
    const b = batches.get(s.id) ?? [];
    // Older stock with no known price is costed like the oldest bill.
    const oldest = [...b].sort((x, y) => (x.date === y.date ? x.billId - y.billId : x.date < y.date ? -1 : 1))[0];
    const olderCost = older.get(s.id) ?? oldest?.cost ?? null;
    out.set(s.id, {
      lots: lotsOnHand(b, s.stock + (addBack.get(s.id) ?? 0), olderCost),
      shortCost: newestCost(b, olderCost),
    });
  }
  return out;
}

export interface SaleRowBatches {
  lineNo: number;
  portions: Portion[];
  /** Average cost of one piece on this row, for profit; null when not known. */
  cost: number | null;
}

/** Takes each sold row's pieces from the oldest batches first, row by row in order. */
export function allocateSale(
  stock: Map<number, StockLots>,
  lines: { lineNo: number; productId: number | null; qty: number }[],
): SaleRowBatches[] {
  const left = new Map([...stock].map(([id, s]) => [id, s.lots]));
  return lines.map((l) => {
    const s = l.productId != null ? stock.get(l.productId) : undefined;
    if (l.productId == null || !s) return { lineNo: l.lineNo, portions: [], cost: null };
    const { portions, rest } = takeOldestFirst(left.get(l.productId) ?? [], l.qty, s.shortCost);
    left.set(l.productId, rest);
    return { lineNo: l.lineNo, portions, cost: unitCost(portions) };
  });
}

/** Saves which bill each sold piece came from, replacing what the invoice had before. */
export async function saveSaleBatches(tx: Tx, invoiceId: number, lines: { lineNo: number; productId: number | null }[], rows: SaleRowBatches[]) {
  await tx.delete(invoiceLineBatches).where(eq(invoiceLineBatches.invoiceId, invoiceId));
  const productOf = new Map(lines.map((l) => [l.lineNo, l.productId]));
  const values = rows.flatMap((r) =>
    r.portions
      .filter((p) => p.qty > 0)
      .map((p) => ({
        invoiceId,
        lineNo: r.lineNo,
        productId: productOf.get(r.lineNo) as number,
        billId: p.billId,
        billNo: p.billNo,
        billDate: p.date,
        qty: p.qty,
        cost: p.cost,
        short: p.short ?? false,
      })),
  );
  if (values.length) await tx.insert(invoiceLineBatches).values(values);
}

import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import type { Tx } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { formatQty } from "@/lib/format";

const round3 = (n: number) => Math.round(n * 1000) / 1000;

type MovementOwner = "billId" | "adjustmentId";

/**
 * Removes every stock movement a record made, as if it had never been saved, so the
 * record itself can be deleted. Stock drops back by what the record added. Throws
 * `fail(message)` when the shelf no longer has that many (they were sold since).
 */
export async function undoStockOf(tx: Tx, owner: MovementOwner, id: number, fail: (message: string) => Error): Promise<void> {
  const column = stockMovements[owner];
  const nets = await tx
    .select({ productId: stockMovements.productId, qty: sql<number>`sum(${stockMovements.qty})`.mapWith(Number) })
    .from(stockMovements)
    .where(eq(column, id))
    .groupBy(stockMovements.productId);
  const changed = nets.filter((n) => round3(n.qty) !== 0);
  if (changed.length) {
    const stock = await tx
      .select({ id: products.id, description: products.description, stockQty: products.stockQty })
      .from(products)
      .where(inArray(products.id, changed.map((n) => n.productId)))
      .orderBy(products.id)
      .for("update");
    for (const n of changed) {
      const p = stock.find((s) => s.id === n.productId);
      if (!p) continue;
      const after = round3(p.stockQty - n.qty);
      if (after < 0) {
        throw fail(`${p.description}: only ${formatQty(p.stockQty)} in stock now, so ${formatQty(n.qty)} cannot be taken back out.`);
      }
      await tx.update(products).set({ stockQty: after }).where(eq(products.id, p.id));
    }
  }
  await tx.delete(stockMovements).where(eq(column, id));
}

import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import { withTransaction, type Tx } from "@/db";
import { products, stockAdjustmentLines, stockAdjustments } from "@/db/schema";
import type { AdjustmentInput } from "@/lib/adjustments/validation";
import { formatQty } from "@/lib/format";
import { financialYear, invoiceNumber } from "@/lib/invoices/math";
import { loadBusiness } from "@/server/settings";

import { moveStock, todayInIndia } from "./invoice-writes";
import { purchasePriceAt } from "./product-search";

/** A problem with what the user entered; the message is safe to show. */
export class AdjustmentInputError extends Error {}

/** Key for the lock that hands out adjustment numbers one at a time. */
const ADJUSTMENT_NUMBER_LOCK = 72_810_006;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function createAdjustment(input: AdjustmentInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    const ids = input.lines.map((l) => l.productId);
    // Lock the parts so a sale saved at the same moment cannot change their stock under us.
    const found = await tx
      .select({
        id: products.id,
        partNo: products.partNo,
        description: products.description,
        unit: products.unit,
        stockQty: products.stockQty,
        cost: purchasePriceAt(0),
      })
      .from(products)
      .where(inArray(products.id, ids))
      .orderBy(products.id)
      .for("update", { of: products });
    const byId = new Map(found.map((p) => [p.id, p]));

    const lines = input.lines.map((l, i) => {
      const p = byId.get(l.productId);
      if (!p) throw new AdjustmentInputError(`Item ${i + 1} was not found. Please remove it and add it again.`);
      const after = round3(p.stockQty + l.qty);
      if (after < 0) {
        throw new AdjustmentInputError(
          `${p.description}: only ${formatQty(p.stockQty)} in stock, so ${formatQty(-l.qty)} cannot be taken out.`,
        );
      }
      return {
        lineNo: i + 1,
        productId: p.id,
        partNo: p.partNo,
        description: p.description,
        unit: p.unit,
        qtyBefore: p.stockQty,
        qty: l.qty,
        cost: p.cost,
      };
    });

    const { adjustmentPrefix } = await loadBusiness(tx);
    const fy = financialYear(input.date);
    // One number at a time, so two people saving together never get the same number.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADJUSTMENT_NUMBER_LOCK})`);
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${stockAdjustments.seq}), 0) + 1`.mapWith(Number) })
      .from(stockAdjustments)
      .where(eq(stockAdjustments.fy, fy));
    const number = invoiceNumber(adjustmentPrefix, fy, next);
    const [{ id }] = await tx
      .insert(stockAdjustments)
      .values({
        number,
        fy,
        seq: next,
        date: input.date,
        reason: input.reason,
        notes: input.notes || null,
        createdBy: userId,
      })
      .returning({ id: stockAdjustments.id });
    await tx.insert(stockAdjustmentLines).values(lines.map((l) => ({ ...l, adjustmentId: id })));
    await moveStock(tx, new Map(lines.map((l) => [l.productId, l.qty])), {
      kind: "adjust",
      adjustmentId: id,
      date: input.date,
      note: `${number} · ${input.reason}`.slice(0, 200),
      userId,
    });
    return id;
  });
}

async function lockAdjustment(tx: Tx, id: number) {
  const [row] = await tx
    .select({ id: stockAdjustments.id, number: stockAdjustments.number, status: stockAdjustments.status })
    .from(stockAdjustments)
    .where(eq(stockAdjustments.id, id))
    .for("update");
  if (!row) throw new AdjustmentInputError("Adjustment not found.");
  if (row.status === "cancelled") throw new AdjustmentInputError("This adjustment is already cancelled.");
  return row;
}

/** Marks the adjustment cancelled and puts every part's stock back as it was changed. */
export async function cancelAdjustment(id: number, reason: string, userId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const adj = await lockAdjustment(tx, id);
    await tx
      .update(stockAdjustments)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
      .where(eq(stockAdjustments.id, id));
    const lines = await tx
      .select({ productId: stockAdjustmentLines.productId, qty: stockAdjustmentLines.qty })
      .from(stockAdjustmentLines)
      .where(eq(stockAdjustmentLines.adjustmentId, id));
    const stock = await tx
      .select({ id: products.id, description: products.description, stockQty: products.stockQty })
      .from(products)
      .where(inArray(products.id, lines.map((l) => l.productId)))
      .orderBy(products.id)
      .for("update");
    for (const l of lines) {
      const p = stock.find((x) => x.id === l.productId);
      if (p && round3(p.stockQty - l.qty) < 0) {
        throw new AdjustmentInputError(
          `${p.description}: only ${formatQty(p.stockQty)} in stock now, so this cannot be undone. ` +
            "Make a new adjustment for the right amount instead.",
        );
      }
    }
    await moveStock(tx, new Map(lines.map((l) => [l.productId, -l.qty])), {
      kind: "adjust_cancel",
      adjustmentId: id,
      date: todayInIndia(),
      note: adj.number,
      userId,
    });
  });
}

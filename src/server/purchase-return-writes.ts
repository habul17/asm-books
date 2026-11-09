import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { withTransaction, type Tx } from "@/db";
import { products, purchaseReturnLines, purchaseReturns, vendors } from "@/db/schema";
import { formatQty } from "@/lib/format";
import { calcInvoice, financialYear, invoiceNumber, taxTypeFor } from "@/lib/invoices/math";
import type { PurchaseReturnInput } from "@/lib/purchase-returns/validation";
import { loadBusiness } from "@/server/settings";

import { moveStock, qtyByProduct, todayInIndia } from "./invoice-writes";

/** A problem with what the user entered; the message is safe to show. */
export class PurchaseReturnInputError extends Error {}

/** Key for the lock that hands out debit note numbers one at a time. */
const DEBIT_NOTE_NUMBER_LOCK = 72_810_007;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Records goods sent back to a vendor: stock goes out and what we owe them goes down. */
export async function createPurchaseReturn(input: PurchaseReturnInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    const business = await loadBusiness(tx);
    const [vendor] = await tx.select().from(vendors).where(eq(vendors.id, input.vendorId));
    if (!vendor) throw new PurchaseReturnInputError("Vendor not found. Please choose again.");

    // Lock the parts: goods can only go back if they are on the shelf.
    const found = await tx
      .select({
        id: products.id,
        partNo: products.partNo,
        description: products.description,
        hsn: products.hsn,
        unit: products.unit,
        stockQty: products.stockQty,
      })
      .from(products)
      .where(inArray(products.id, input.lines.map((l) => l.productId)))
      .orderBy(products.id)
      .for("update");
    const byId = new Map(found.map((p) => [p.id, p]));

    const lines = input.lines.map((l, i) => {
      const p = byId.get(l.productId);
      if (!p) throw new PurchaseReturnInputError(`Item ${i + 1}: this part no longer exists.`);
      const qty = round3(l.qty);
      if (round3(p.stockQty - qty) < 0) {
        throw new PurchaseReturnInputError(
          `${p.description}: only ${formatQty(Math.max(p.stockQty, 0))} ${p.unit} in stock, so ${formatQty(qty)} cannot be sent back.`,
        );
      }
      return {
        lineNo: i + 1,
        productId: p.id,
        partNo: p.partNo,
        description: p.description,
        hsn: p.hsn,
        unit: p.unit,
        qty,
        rate: l.rate,
        discountPct: l.discountPct,
        gstRate: l.gstRate,
      };
    });

    const taxType = taxTypeFor(business.stateCode || null, vendor.stateCode || business.stateCode || null);
    const { lines: calculated, totals } = calcInvoice(lines, taxType);
    const fy = financialYear(input.date);

    // One number at a time, so two people saving together never get the same number.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${DEBIT_NOTE_NUMBER_LOCK})`);
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${purchaseReturns.seq}), 0) + 1`.mapWith(Number) })
      .from(purchaseReturns)
      .where(eq(purchaseReturns.fy, fy));
    const number = invoiceNumber(business.debitNotePrefix, fy, next);

    const [{ id }] = await tx
      .insert(purchaseReturns)
      .values({
        number,
        fy,
        seq: next,
        date: input.date,
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorGstin: vendor.gstin,
        billRef: input.billRef || null,
        taxType,
        reason: input.reason,
        notes: input.notes || null,
        ...totals,
        createdBy: userId,
      })
      .returning({ id: purchaseReturns.id });
    await tx.insert(purchaseReturnLines).values(calculated.map((l) => ({ ...l, purchaseReturnId: id })));

    const out = new Map([...qtyByProduct(calculated)].map(([p, q]) => [p, -q]));
    await moveStock(tx, out, { kind: "purchase_return", purchaseReturnId: id, date: input.date, note: number, userId });
    return id;
  });
}

async function lockPurchaseReturn(tx: Tx, id: number) {
  const [row] = await tx
    .select({ id: purchaseReturns.id, number: purchaseReturns.number, status: purchaseReturns.status })
    .from(purchaseReturns)
    .where(eq(purchaseReturns.id, id))
    .for("update");
  if (!row) throw new PurchaseReturnInputError("Purchase return not found.");
  if (row.status === "cancelled") throw new PurchaseReturnInputError("This purchase return is already cancelled.");
  return row;
}

/** Marks the return cancelled: the parts come back into stock and what we owe the vendor goes back up. */
export async function cancelPurchaseReturn(id: number, reason: string, userId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const pr = await lockPurchaseReturn(tx, id);
    await tx
      .update(purchaseReturns)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
      .where(and(eq(purchaseReturns.id, id), eq(purchaseReturns.status, "final")));
    const lines = await tx
      .select({ productId: purchaseReturnLines.productId, qty: purchaseReturnLines.qty })
      .from(purchaseReturnLines)
      .where(eq(purchaseReturnLines.purchaseReturnId, id));
    await moveStock(tx, qtyByProduct(lines), {
      kind: "purchase_return_cancel",
      purchaseReturnId: id,
      date: todayInIndia(),
      note: pr.number,
      userId,
    });
  });
}

import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { withTransaction, type Tx } from "@/db";
import { bills, purchaseOrderLines, purchaseOrders } from "@/db/schema";
import { calcInvoice, financialYear, invoiceNumber, taxTypeFor } from "@/lib/invoices/math";
import type { PurchaseOrderInput, PurchaseOrderStatus } from "@/lib/purchase-orders/validation";
import { loadBusiness } from "@/server/settings";

import { BillInputError, buildPurchaseLines, loadPurchaseVendor } from "./bill-writes";

/** Key for the lock that hands out purchase order numbers one at a time. */
const PURCHASE_ORDER_NUMBER_LOCK = 72_810_008;

interface ExistingOrder {
  fy: string;
  vendorId: number;
}

/** Checks the input against the database and works out every amount. */
async function prepare(tx: Tx, input: PurchaseOrderInput, existing: ExistingOrder | null) {
  const business = await loadBusiness(tx);
  const fy = financialYear(input.date);
  if (existing && fy !== existing.fy) {
    throw new BillInputError(`This purchase order belongs to the year ${existing.fy}. Keep the date inside that year.`);
  }
  const vendor = await loadPurchaseVendor(tx, input.vendorId, existing?.vendorId);
  const lines = await buildPurchaseLines(tx, input.lines);
  const taxType = taxTypeFor(business.stateCode || null, vendor.stateCode || business.stateCode || null);
  const { lines: calculated, totals } = calcInvoice(lines, taxType);
  const header = {
    vendorId: vendor.id,
    date: input.date,
    expectedDate: input.expectedDate,
    taxType,
    notes: input.notes || null,
    ...totals,
  };
  return { fy, prefix: business.purchaseOrderPrefix, header, lines: calculated };
}

export async function createPurchaseOrder(input: PurchaseOrderInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    const { fy, prefix, header, lines } = await prepare(tx, input, null);
    // One number at a time, so two people saving together never get the same number.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${PURCHASE_ORDER_NUMBER_LOCK})`);
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${purchaseOrders.seq}), 0) + 1`.mapWith(Number) })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.fy, fy));
    const [{ id }] = await tx
      .insert(purchaseOrders)
      .values({ ...header, number: invoiceNumber(prefix, fy, next), fy, seq: next, createdBy: userId })
      .returning({ id: purchaseOrders.id });
    await tx.insert(purchaseOrderLines).values(lines.map((l) => ({ ...l, orderId: id })));
    return id;
  });
}

async function lockOrder(tx: Tx, id: number) {
  const [order] = await tx
    .select({
      id: purchaseOrders.id,
      fy: purchaseOrders.fy,
      status: purchaseOrders.status,
      vendorId: purchaseOrders.vendorId,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, id))
    .for("update");
  if (!order) throw new BillInputError("This purchase order was not found.");
  return order;
}

export async function updatePurchaseOrder(id: number, input: PurchaseOrderInput): Promise<void> {
  await withTransaction(async (tx) => {
    const existing = await lockOrder(tx, id);
    if (existing.status !== "open") {
      throw new BillInputError(`This purchase order is ${existing.status} and cannot be changed.`);
    }
    const { header, lines } = await prepare(tx, input, existing);
    await tx.update(purchaseOrders).set(header).where(eq(purchaseOrders.id, id));
    await tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.orderId, id));
    await tx.insert(purchaseOrderLines).values(lines.map((l) => ({ ...l, orderId: id })));
  });
}

/**
 * Closes, reopens or cancels a purchase order. Only an open one can be closed
 * or cancelled, and one with a bill is closed rather than cancelled. A closed
 * one can always be reopened, e.g. when part of the order is still to come.
 */
export async function setPurchaseOrderStatus(id: number, to: PurchaseOrderStatus): Promise<void> {
  await withTransaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (to === "open") {
      if (order.status !== "closed") throw new BillInputError("Only a closed purchase order can be reopened.");
    } else if (order.status !== "open") {
      throw new BillInputError(`This purchase order is already ${order.status}.`);
    } else if (to === "cancelled") {
      const [billed] = await tx
        .select({ billNo: bills.billNo })
        .from(bills)
        .where(and(eq(bills.purchaseOrderId, id), eq(bills.status, "final")))
        .limit(1);
      if (billed) {
        throw new BillInputError(`Bill ${billed.billNo} was entered for this order. Mark it as closed instead.`);
      }
    }
    await tx.update(purchaseOrders).set({ status: to }).where(eq(purchaseOrders.id, id));
  });
}

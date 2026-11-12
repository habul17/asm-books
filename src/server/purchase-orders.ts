import "server-only";

import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { bills, purchaseOrderLines, purchaseOrders, users, vendors } from "@/db/schema";
import type { PurchaseOrderStatus } from "@/lib/purchase-orders/validation";
import { requireUser } from "@/server/auth";

export const PURCHASE_ORDER_LIMIT = 100;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface PurchaseOrderFilters {
  query: string;
  status: PurchaseOrderStatus | "all";
  vendorId: number | null;
}

/** Every word must appear in the order number, vendor name or mobile. */
export async function searchPurchaseOrders(filters: PurchaseOrderFilters, limit = PURCHASE_ORDER_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [
    filters.status === "all" ? undefined : eq(purchaseOrders.status, filters.status),
    filters.vendorId ? eq(purchaseOrders.vendorId, filters.vendorId) : undefined,
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(or(ilike(purchaseOrders.number, like), ilike(vendors.name, like), ilike(vendors.mobile, like)));
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(purchaseOrders)
      .innerJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
      .where(where),
    db
      .select({
        id: purchaseOrders.id,
        number: purchaseOrders.number,
        date: purchaseOrders.date,
        expectedDate: purchaseOrders.expectedDate,
        vendorName: vendors.name,
        grandTotal: purchaseOrders.grandTotal,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .innerJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
      .where(where)
      .orderBy(desc(purchaseOrders.date), desc(purchaseOrders.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, items };
}

/** One purchase order with its lines and bills, shaped for the printed order. */
export async function getPurchaseOrder(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = getDb();
  const [heads, lines, orderBills] = await db.batch([
    db
      .select({
        order: purchaseOrders,
        vendorName: vendors.name,
        vendorGstin: vendors.gstin,
        vendorAddress: vendors.address,
        vendorCity: vendors.city,
        vendorPincode: vendors.pincode,
        vendorMobile: vendors.mobile,
        vendorState: vendors.stateCode,
        createdByName: users.name,
      })
      .from(purchaseOrders)
      .innerJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
      .leftJoin(users, eq(users.id, purchaseOrders.createdBy))
      .where(eq(purchaseOrders.id, id)),
    db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.orderId, id))
      .orderBy(asc(purchaseOrderLines.lineNo)),
    // Bills entered for this order.
    db
      .select({ id: bills.id, billNo: bills.billNo, status: bills.status })
      .from(bills)
      .where(eq(bills.purchaseOrderId, id))
      .orderBy(asc(bills.id)),
  ]);
  const head = heads[0];
  if (!head) return null;
  const { order } = head;
  const cityLine = [head.vendorCity, head.vendorPincode].filter(Boolean).join(" - ");
  return {
    ...order,
    vendorName: head.vendorName,
    createdByName: head.createdByName,
    // The fields the shared tax document prints for the other party.
    customerName: head.vendorName,
    customerGstin: head.vendorGstin,
    customerMobile: head.vendorMobile,
    billingAddress: [head.vendorAddress, cityLine].filter(Boolean).join("\n") || null,
    placeOfSupply: head.vendorState,
    bills: orderBills,
    lines,
  };
}

export type PurchaseOrderDetail = NonNullable<Awaited<ReturnType<typeof getPurchaseOrder>>>;

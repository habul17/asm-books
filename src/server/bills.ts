import "server-only";

import { and, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { billLines, bills, categories, products, purchaseOrders, users, vendors } from "@/db/schema";
import { type LastBillPrice, netRate } from "@/lib/bills/price-check";
import { requireUser } from "@/server/auth";
import { billScanReady } from "@/server/bill-scan";
import { loadBusiness } from "@/server/settings";

import { productSearch, purchasePriceAt } from "./product-search";
import { vendorBalance } from "./vendors";

export const BILL_LIMIT = 100;
const PICK_LIMIT = 15;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type BillStatusFilter = "all" | "final" | "cancelled";

export interface BillFilters {
  query: string;
  status: BillStatusFilter;
  vendorId: number | null;
}

/** Every word must appear in the vendor's bill number, vendor name or mobile. */
export async function searchBills(filters: BillFilters, limit = BILL_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [
    filters.status === "all" ? undefined : eq(bills.status, filters.status),
    filters.vendorId ? eq(bills.vendorId, filters.vendorId) : undefined,
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(or(ilike(bills.billNo, like), ilike(vendors.name, like), ilike(vendors.mobile, like)));
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        total: sql<number>`coalesce(sum(${bills.grandTotal}) FILTER (WHERE ${bills.status} = 'final'), 0)`.mapWith(Number),
      })
      .from(bills)
      .innerJoin(vendors, eq(vendors.id, bills.vendorId))
      .where(where),
    db
      .select({
        id: bills.id,
        billNo: bills.billNo,
        date: bills.date,
        dueDate: bills.dueDate,
        vendorId: bills.vendorId,
        vendorName: vendors.name,
        grandTotal: bills.grandTotal,
        status: bills.status,
      })
      .from(bills)
      .innerJoin(vendors, eq(vendors.id, bills.vendorId))
      .where(where)
      .orderBy(desc(bills.date), desc(bills.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, total: summary[0]?.total ?? 0, items };
}

export type BillListItem = Awaited<ReturnType<typeof searchBills>>["items"][number];

/** One bill with its lines, its vendor and what we owe that vendor now. */
export async function getBill(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = getDb();
  const [heads, lines] = await db.batch([
    db
      .select({
        bill: bills,
        vendorName: vendors.name,
        vendorGstin: vendors.gstin,
        vendorCity: vendors.city,
        vendorMobile: vendors.mobile,
        balanceNow: vendorBalance,
        createdByName: users.name,
        purchaseOrderNumber: purchaseOrders.number,
      })
      .from(bills)
      .innerJoin(vendors, eq(vendors.id, bills.vendorId))
      .leftJoin(users, eq(users.id, bills.createdBy))
      .leftJoin(purchaseOrders, eq(purchaseOrders.id, bills.purchaseOrderId))
      .where(eq(bills.id, id)),
    db.select().from(billLines).where(eq(billLines.billId, id)).orderBy(asc(billLines.lineNo)),
  ]);
  const head = heads[0];
  if (!head) return null;
  const { bill, ...rest } = head;
  return { ...bill, ...rest, lines };
}

export type BillDetail = NonNullable<Awaited<ReturnType<typeof getBill>>>;

/** Parts matching the search, with their latest purchase price as the suggested rate. */
export async function pickBillItems(query: string) {
  await requireUser();
  const db = getDb();
  const business = await loadBusiness(db);
  const { where, rank } = productSearch(query);
  const rows = await db
    .select({
      id: products.id,
      partNo: products.partNo,
      description: products.description,
      photo: products.photo,
      unit: products.unit,
      gstRate: products.gstRate,
      stockQty: products.stockQty,
      price: purchasePriceAt(0),
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(rank, asc(products.sort), asc(products.id))
    .limit(PICK_LIMIT);
  return rows.map((r) => ({ ...r, gstRate: r.gstRate ?? business.defaultGstRate }));
}

/** These parts as `pickBillItems` returns them, for rows filled in by a scan. */
export async function pickBillItemsById(ids: number[]) {
  await requireUser();
  if (!ids.length) return [];
  const db = getDb();
  const business = await loadBusiness(db);
  const rows = await db
    .select({
      id: products.id,
      partNo: products.partNo,
      description: products.description,
      photo: products.photo,
      unit: products.unit,
      gstRate: products.gstRate,
      stockQty: products.stockQty,
      price: purchasePriceAt(0),
    })
    .from(products)
    .where(inArray(products.id, ids));
  return rows.map((r) => ({ ...r, gstRate: r.gstRate ?? business.defaultGstRate }));
}

/** Most parts one price check looks up; a bill is far shorter than this. */
export const PRICE_CHECK_MAX = 500;

/**
 * Each part's rate on the newest saved bill that had it, leaving out `exceptBillId`
 * (the bill being edited). Null for a part that was never on a saved bill.
 */
export async function lastBillPrices(productIds: number[], exceptBillId: number | null) {
  await requireUser();
  const ids = [...new Set(productIds)].slice(0, PRICE_CHECK_MAX);
  const out: Record<number, LastBillPrice | null> = Object.fromEntries(ids.map((id) => [id, null]));
  if (!ids.length) return out;
  const rows = await getDb()
    .selectDistinctOn([billLines.productId], {
      productId: billLines.productId,
      rate: billLines.rate,
      discountPct: billLines.discountPct,
      date: bills.date,
      billNo: bills.billNo,
      vendor: vendors.name,
    })
    .from(billLines)
    .innerJoin(bills, eq(bills.id, billLines.billId))
    .innerJoin(vendors, eq(vendors.id, bills.vendorId))
    .where(
      and(
        inArray(billLines.productId, ids),
        eq(bills.status, "final"),
        exceptBillId != null ? ne(bills.id, exceptBillId) : undefined,
      ),
    )
    .orderBy(billLines.productId, desc(bills.date), desc(bills.id), desc(billLines.lineNo));
  for (const r of rows) {
    if (r.productId == null) continue;
    out[r.productId] = { net: netRate(r.rate, r.discountPct), date: r.date, billNo: r.billNo, vendor: r.vendor };
  }
  return out;
}

/** What the bill editor needs besides the bill itself. */
export async function getBillEditorOptions() {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const business = await loadBusiness(getDb());
  return { sellerState: business.stateCode || null, defaultGstRate: business.defaultGstRate, scanReady: billScanReady() };
}

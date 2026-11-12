import "server-only";

import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { billLines, bills, categories, products, purchaseOrders, users, vendors } from "@/db/schema";
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

/** What the bill editor needs besides the bill itself. */
export async function getBillEditorOptions() {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const business = await loadBusiness(getDb());
  return { sellerState: business.stateCode || null, defaultGstRate: business.defaultGstRate, scanReady: billScanReady() };
}

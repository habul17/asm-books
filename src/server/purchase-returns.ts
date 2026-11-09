import "server-only";

import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { purchaseReturnLines, purchaseReturns, users, vendors } from "@/db/schema";
import { requireUser } from "@/server/auth";

import { vendorBalance } from "./vendors";

export const PURCHASE_RETURN_LIMIT = 100;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type PurchaseReturnStatusFilter = "all" | "final" | "cancelled";

export interface PurchaseReturnFilters {
  query: string;
  status: PurchaseReturnStatusFilter;
  vendorId: number | null;
}

/** Every word must appear in the debit note number, the vendor's name or the bill reference. */
export async function searchPurchaseReturns(filters: PurchaseReturnFilters, limit = PURCHASE_RETURN_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [
    filters.status === "all" ? undefined : eq(purchaseReturns.status, filters.status),
    filters.vendorId ? eq(purchaseReturns.vendorId, filters.vendorId) : undefined,
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(ilike(purchaseReturns.number, like), ilike(purchaseReturns.vendorName, like), ilike(purchaseReturns.billRef, like)),
    );
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        total: sql<number>`coalesce(sum(${purchaseReturns.grandTotal}) FILTER (WHERE ${purchaseReturns.status} = 'final'), 0)`.mapWith(
          Number,
        ),
      })
      .from(purchaseReturns)
      .where(where),
    db
      .select({
        id: purchaseReturns.id,
        number: purchaseReturns.number,
        date: purchaseReturns.date,
        vendorName: purchaseReturns.vendorName,
        billRef: purchaseReturns.billRef,
        reason: purchaseReturns.reason,
        grandTotal: purchaseReturns.grandTotal,
        status: purchaseReturns.status,
      })
      .from(purchaseReturns)
      .where(where)
      .orderBy(desc(purchaseReturns.date), desc(purchaseReturns.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, total: summary[0]?.total ?? 0, items };
}

/** One purchase return with its lines, shaped for the printed debit note. */
export async function getPurchaseReturn(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = getDb();
  const [heads, lines] = await db.batch([
    db
      .select({
        pr: purchaseReturns,
        vendorAddress: vendors.address,
        vendorCity: vendors.city,
        vendorPincode: vendors.pincode,
        vendorMobile: vendors.mobile,
        vendorState: vendors.stateCode,
        balanceNow: vendorBalance,
        createdByName: users.name,
      })
      .from(purchaseReturns)
      .innerJoin(vendors, eq(vendors.id, purchaseReturns.vendorId))
      .leftJoin(users, eq(users.id, purchaseReturns.createdBy))
      .where(eq(purchaseReturns.id, id)),
    db
      .select()
      .from(purchaseReturnLines)
      .where(eq(purchaseReturnLines.purchaseReturnId, id))
      .orderBy(asc(purchaseReturnLines.lineNo)),
  ]);
  const head = heads[0];
  if (!head) return null;
  const { pr } = head;
  const cityLine = [head.vendorCity, head.vendorPincode].filter(Boolean).join(" - ");
  return {
    ...pr,
    balanceNow: head.balanceNow,
    createdByName: head.createdByName,
    // The fields the shared tax document prints for the other party.
    customerName: pr.vendorName,
    customerGstin: pr.vendorGstin,
    customerMobile: head.vendorMobile,
    billingAddress: [head.vendorAddress, cityLine].filter(Boolean).join("\n") || null,
    placeOfSupply: head.vendorState,
    lines,
  };
}

export type PurchaseReturnDetail = NonNullable<Awaited<ReturnType<typeof getPurchaseReturn>>>;

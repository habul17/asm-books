import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { users, vendorPayments, vendors } from "@/db/schema";
import { requireUser } from "@/server/auth";

import { vendorBalance } from "./vendors";

export const VENDOR_PAYMENT_LIMIT = 100;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type VendorPaymentStatusFilter = "all" | "final" | "cancelled";

export interface VendorPaymentFilters {
  query: string;
  status: VendorPaymentStatusFilter;
  vendorId: number | null;
}

/** Every word must appear in the payment number, reference, vendor name or mobile. */
export async function searchVendorPayments(filters: VendorPaymentFilters, limit = VENDOR_PAYMENT_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [
    filters.status === "all" ? undefined : eq(vendorPayments.status, filters.status),
    filters.vendorId ? eq(vendorPayments.vendorId, filters.vendorId) : undefined,
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(
        ilike(vendorPayments.number, like),
        ilike(vendorPayments.reference, like),
        ilike(vendors.name, like),
        ilike(vendors.mobile, like),
      ),
    );
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        total: sql<number>`coalesce(sum(${vendorPayments.amount}) FILTER (WHERE ${vendorPayments.status} = 'final'), 0)`.mapWith(
          Number,
        ),
      })
      .from(vendorPayments)
      .innerJoin(vendors, eq(vendors.id, vendorPayments.vendorId))
      .where(where),
    db
      .select({
        id: vendorPayments.id,
        number: vendorPayments.number,
        date: vendorPayments.date,
        vendorId: vendorPayments.vendorId,
        vendorName: vendors.name,
        amount: vendorPayments.amount,
        mode: vendorPayments.mode,
        reference: vendorPayments.reference,
        status: vendorPayments.status,
      })
      .from(vendorPayments)
      .innerJoin(vendors, eq(vendors.id, vendorPayments.vendorId))
      .where(where)
      .orderBy(desc(vendorPayments.date), desc(vendorPayments.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, total: summary[0]?.total ?? 0, items };
}

/** One payment made, with its vendor's details and what we owe them now. */
export async function getVendorPayment(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb()
    .select({
      id: vendorPayments.id,
      number: vendorPayments.number,
      date: vendorPayments.date,
      amount: vendorPayments.amount,
      mode: vendorPayments.mode,
      reference: vendorPayments.reference,
      notes: vendorPayments.notes,
      status: vendorPayments.status,
      cancelReason: vendorPayments.cancelReason,
      vendorId: vendorPayments.vendorId,
      vendorName: vendors.name,
      vendorMobile: vendors.mobile,
      vendorGstin: vendors.gstin,
      vendorAddress: vendors.address,
      vendorCity: vendors.city,
      balanceNow: vendorBalance,
      createdByName: users.name,
    })
    .from(vendorPayments)
    .innerJoin(vendors, eq(vendors.id, vendorPayments.vendorId))
    .leftJoin(users, eq(users.id, vendorPayments.createdBy))
    .where(eq(vendorPayments.id, id));
  return row ?? null;
}

export type VendorPaymentDetail = NonNullable<Awaited<ReturnType<typeof getVendorPayment>>>;

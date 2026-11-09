import "server-only";

import { and, asc, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { bills, vendorPayments, vendors } from "@/db/schema";
import { col } from "@/db/sql";
import { GST_STATES } from "@/lib/gst";
import { requireUser } from "@/server/auth";

export const VENDOR_LIMIT = 100;
const PICK_LIMIT = 15;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * What we owe the vendor right now. Positive: we owe them; negative: we paid in advance.
 * Opening balance plus active bills, minus active payments made to them.
 */
export const vendorBalance = sql<number>`(${col(vendors.openingBalance)} + coalesce((
  SELECT sum(${col(bills.grandTotal)}) FROM ${bills}
  WHERE ${col(bills.vendorId)} = ${col(vendors.id)} AND ${col(bills.status)} = 'final'
), 0) - coalesce((
  SELECT sum(${col(vendorPayments.amount)}) FROM ${vendorPayments}
  WHERE ${col(vendorPayments.vendorId)} = ${col(vendors.id)} AND ${col(vendorPayments.status)} = 'final'
), 0))`.mapWith(Number);

function wordConditions(query: string) {
  const words = query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  return words.map((word) => {
    const like = `%${escapeLike(word)}%`;
    return or(
      ilike(vendors.name, like),
      ilike(vendors.mobile, like),
      ilike(vendors.gstin, like),
      ilike(vendors.city, like),
      ilike(vendors.contactPerson, like),
    );
  });
}

export interface VendorFilters {
  query: string;
  showInactive: boolean;
}

/** Every word must appear in the name, mobile, GSTIN, city or contact person. */
export async function searchVendors(filters: VendorFilters, limit = VENDOR_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const conditions: (SQL | undefined)[] = [
    filters.showInactive ? undefined : eq(vendors.active, true),
    ...wordConditions(filters.query),
  ];
  const where = and(...conditions);
  const db = getDb();
  const [countRows, items] = await db.batch([
    db.select({ total: count() }).from(vendors).where(where),
    db
      .select({
        id: vendors.id,
        name: vendors.name,
        mobile: vendors.mobile,
        city: vendors.city,
        gstin: vendors.gstin,
        active: vendors.active,
        balance: vendorBalance,
      })
      .from(vendors)
      .where(where)
      .orderBy(sql`lower(${vendors.name})`, asc(vendors.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { total: countRows[0]?.total ?? 0, items };
}

export async function getVendor(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb()
    .select({ vendor: vendors, balance: vendorBalance })
    .from(vendors)
    .where(eq(vendors.id, id));
  if (!row) return null;
  const v = row.vendor;
  return { ...v, balance: row.balance, stateName: v.stateCode ? (GST_STATES[v.stateCode] ?? null) : null };
}

export type VendorDetail = NonNullable<Awaited<ReturnType<typeof getVendor>>>;

const pickedColumns = {
  id: vendors.id,
  name: vendors.name,
  city: vendors.city,
  mobile: vendors.mobile,
  stateCode: vendors.stateCode,
  paymentTermsDays: vendors.paymentTermsDays,
  balance: vendorBalance,
};

/** Active vendors matching the words, for the bill's vendor picker. */
export async function pickVendors(query: string) {
  await requireUser();
  return getDb()
    .select(pickedColumns)
    .from(vendors)
    .where(and(eq(vendors.active, true), ...wordConditions(query)))
    .orderBy(sql`lower(${vendors.name})`)
    .limit(PICK_LIMIT);
}

/** One vendor as the bill editor shows them (also switched-off ones, for old bills). */
export async function pickVendorById(id: number) {
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb().select(pickedColumns).from(vendors).where(eq(vendors.id, id));
  return row ?? null;
}

export type PickedVendor = Awaited<ReturnType<typeof pickVendors>>[number];

/** Vendors to choose from in the expense form: active ones, plus `keepId` if it was switched off. */
export async function vendorOptions(keepId: number | null = null) {
  await requireUser();
  return getDb()
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .where(keepId ? or(eq(vendors.active, true), eq(vendors.id, keepId)) : eq(vendors.active, true))
    .orderBy(sql`lower(${vendors.name})`)
    .limit(1000);
}

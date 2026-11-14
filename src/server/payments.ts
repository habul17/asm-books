import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { customers, payments, users } from "@/db/schema";
import { requireUser } from "@/server/auth";

import { customerBalance } from "./customers";
import { canChangeToday } from "@/lib/edit-window";

export const PAYMENT_LIMIT = 100;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type PaymentStatusFilter = "all" | "final" | "cancelled";

export interface PaymentFilters {
  query: string;
  status: PaymentStatusFilter;
  customerId: number | null;
}

/** Every word must appear in the receipt number, reference, customer name or mobile. */
export async function searchPayments(filters: PaymentFilters, limit = PAYMENT_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [
    filters.status === "all" ? undefined : eq(payments.status, filters.status),
    filters.customerId ? eq(payments.customerId, filters.customerId) : undefined,
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(
        ilike(payments.number, like),
        ilike(payments.reference, like),
        ilike(customers.name, like),
        ilike(customers.mobile, like),
      ),
    );
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        total: sql<number>`coalesce(sum(${payments.amount}) FILTER (WHERE ${payments.status} = 'final'), 0)`.mapWith(
          Number,
        ),
      })
      .from(payments)
      .innerJoin(customers, eq(customers.id, payments.customerId))
      .where(where),
    db
      .select({
        id: payments.id,
        number: payments.number,
        date: payments.date,
        customerId: payments.customerId,
        customerName: customers.name,
        amount: payments.amount,
        mode: payments.mode,
        reference: payments.reference,
        status: payments.status,
      })
      .from(payments)
      .innerJoin(customers, eq(customers.id, payments.customerId))
      .where(where)
      .orderBy(desc(payments.date), desc(payments.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, total: summary[0]?.total ?? 0, items };
}

export type PaymentListItem = Awaited<ReturnType<typeof searchPayments>>["items"][number];

/** One payment with its customer's details and their balance now. */
export async function getPayment(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb()
    .select({
      id: payments.id,
      number: payments.number,
      date: payments.date,
      amount: payments.amount,
      mode: payments.mode,
      reference: payments.reference,
      notes: payments.notes,
      status: payments.status,
      cancelReason: payments.cancelReason,
      customerId: payments.customerId,
      customerName: customers.name,
      customerMobile: customers.mobile,
      customerGstin: customers.gstin,
      customerAddress: customers.address,
      customerCity: customers.city,
      balanceNow: customerBalance,
      createdByName: users.name,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(customers, eq(customers.id, payments.customerId))
    .leftJoin(users, eq(users.id, payments.createdBy))
    .where(eq(payments.id, id));
  if (!row) return null;
  /** Staff may change a payment only on the day it was made. */
  return { ...row, canChange: canChangeToday(user.role === "owner", row.createdAt) };
}

export type PaymentDetail = NonNullable<Awaited<ReturnType<typeof getPayment>>>;

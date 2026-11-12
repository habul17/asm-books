import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";

import { getDb } from "@/db";
import { customers, invoices, products } from "@/db/schema";
import { findLatePayers, type LatePayer } from "@/lib/reminders/late-payments";
import { isOwner, requireUser } from "@/server/auth";

import { customerBalance } from "./customers";
import { todayInIndia } from "./invoice-writes";
import { lowStockWhere } from "./reports";
import { loadBusiness } from "./settings";

/**
 * Customers with a bill left unpaid for `days` days or more, as of `today`.
 * No auth check: only for code that has already checked the user.
 */
export async function loadLatePayers(today: string, days: number): Promise<LatePayer[]> {
  const db = getDb();
  // Every credit invoice with the total of the same customer's newer ones beside it.
  const ranked = db
    .select({
      id: invoices.id,
      number: invoices.number,
      customerId: invoices.customerId,
      date: invoices.date,
      dueDate: invoices.dueDate,
      grandTotal: invoices.grandTotal,
      newer: sql<number>`(sum(${invoices.grandTotal}) OVER (
        PARTITION BY ${invoices.customerId} ORDER BY ${invoices.date} DESC, ${invoices.id} DESC
      ) - ${invoices.grandTotal})`
        .mapWith(Number)
        .as("newer"),
    })
    .from(invoices)
    .where(and(eq(invoices.status, "final"), eq(invoices.paymentType, "credit"), isNotNull(invoices.customerId)))
    .as("ranked");

  const [owing, open] = await db.batch([
    db
      .select({
        id: customers.id,
        name: customers.name,
        mobile: customers.mobile,
        city: customers.city,
        since: sql<string>`(${customers.createdAt} AT TIME ZONE 'Asia/Kolkata')::date::text`,
        balance: customerBalance,
      })
      .from(customers)
      .where(sql`${customerBalance} >= 1`),
    // Only the invoices the balance reaches back to: the ones still unpaid.
    db
      .select({
        id: ranked.id,
        number: ranked.number,
        customerId: ranked.customerId,
        date: ranked.date,
        dueDate: ranked.dueDate,
        grandTotal: ranked.grandTotal,
        newer: ranked.newer,
      })
      .from(ranked)
      .innerJoin(customers, eq(customers.id, ranked.customerId))
      .where(sql`${ranked.newer} < ${customerBalance}`),
  ]);

  return findLatePayers(
    owing,
    open.map((inv) => ({ ...inv, customerId: inv.customerId as number })),
    today,
    days,
  );
}

/**
 * What needs attention today. Late payers are for the owner only (`late` is null
 * for staff); low stock is for everyone. Shared by the bell, Home and the
 * Reminders screen, so one page load reads it once.
 */
export const getReminders = cache(async () => {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  const business = await loadBusiness();
  const days = business.paymentReminderDays;
  const [late, stockRows] = await Promise.all([
    isOwner(user) ? loadLatePayers(todayInIndia(), days) : null,
    getDb()
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .where(lowStockWhere(business.defaultMinStock)),
  ]);
  const lowStock = stockRows[0]?.count ?? 0;
  return {
    days,
    businessName: business.name,
    late,
    lateAmount: late ? Math.round(late.reduce((sum, p) => sum + p.lateAmount, 0) * 100) / 100 : 0,
    lowStock,
    /** The number shown on the bell. */
    count: (late?.length ?? 0) + lowStock,
  };
});

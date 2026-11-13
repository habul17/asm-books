import "server-only";

import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";

import { getDb } from "@/db";
import { products } from "@/db/schema";
import { findLatePayers, type LatePayer } from "@/lib/reminders/late-payments";
import { isOwner, requireUser } from "@/server/auth";

import { todayInIndia } from "./invoice-writes";
import { loadUnpaid } from "./receivables";
import { loadDueRecurring } from "./recurring";
import { lowStockWhere } from "./reports";
import { loadBusiness } from "./settings";

/**
 * Customers with a bill left unpaid for `days` days or more, as of `today`.
 * No auth check: only for code that has already checked the user.
 */
export async function loadLatePayers(today: string, days: number): Promise<LatePayer[]> {
  const { owing, open } = await loadUnpaid();
  return findLatePayers(owing, open, today, days);
}

/**
 * What needs attention today. Late payers are for the owner only (`late` is null
 * for staff); low stock and recurring invoices that are due are for everyone. Shared by the bell, Home and the
 * Reminders screen, so one page load reads it once.
 */
export const getReminders = cache(async () => {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  const business = await loadBusiness();
  const days = business.paymentReminderDays;
  const today = todayInIndia();
  const [late, recurring, stockRows] = await Promise.all([
    isOwner(user) ? loadLatePayers(today, days) : null,
    loadDueRecurring(today),
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
    /** Recurring invoices whose next date has come. */
    recurring,
    /** The number shown on the bell. */
    count: (late?.length ?? 0) + lowStock + recurring.length,
  };
});

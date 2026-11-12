import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { customers, invoices } from "@/db/schema";
import type { OpenInvoice, OwingCustomer } from "@/lib/reminders/late-payments";
import { ageReceivables } from "@/lib/reports/aging";
import { requireOwner } from "@/server/auth";

import { customerBalance } from "./customers";
import { todayInIndia } from "./invoice-writes";

/**
 * Every customer who owes a rupee or more, and the credit invoices their balance
 * reaches back to. Payments are not tied to invoices, so they count against the
 * oldest ones first and the newest invoices are the unpaid ones.
 * No auth check: only for code that has already checked the user.
 */
export async function loadUnpaid(): Promise<{ owing: OwingCustomer[]; open: OpenInvoice[] }> {
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
  return { owing, open: open.map((inv) => ({ ...inv, customerId: inv.customerId as number })) };
}

/** What customers owe today, split by the age of the unpaid bills. */
export async function arAging() {
  await connection(); // Always read live data; never prerender at build time.
  await requireOwner();
  const today = todayInIndia();
  const { owing, open } = await loadUnpaid();
  return { today, ...ageReceivables(owing, open, today) };
}

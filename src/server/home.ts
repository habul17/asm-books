import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { customers, invoices } from "@/db/schema";
import { requireUser } from "@/server/auth";

import { customerBalance } from "./customers";
import { todayInIndia } from "./invoice-writes";

/** Numbers for the Home screen: sales today and this month, money owed to us, latest bills. */
export async function getHomeSummary() {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const today = todayInIndia();
  const monthStart = `${today.slice(0, 8)}01`;
  const final = eq(invoices.status, "final");
  const db = getDb();

  const [salesRows, owedRows, recent] = await db.batch([
    db
      .select({
        today: sql<number>`coalesce(sum(${invoices.grandTotal}) FILTER (WHERE ${invoices.date} = ${today}), 0)`.mapWith(
          Number,
        ),
        todayCount: sql<number>`count(*) FILTER (WHERE ${invoices.date} = ${today})`.mapWith(Number),
        month: sql<number>`coalesce(sum(${invoices.grandTotal}), 0)`.mapWith(Number),
        monthCount: sql<number>`count(*)`.mapWith(Number),
      })
      .from(invoices)
      .where(and(final, gte(invoices.date, monthStart))),
    db
      .select({
        receivable: sql<number>`coalesce(sum(greatest(${customerBalance}, 0)), 0)`.mapWith(Number),
        owingCount: sql<number>`count(*) FILTER (WHERE ${customerBalance} > 0)`.mapWith(Number),
        overLimit: sql<number>`count(*) FILTER (
          WHERE ${customers.creditLimit} IS NOT NULL AND ${customerBalance} > ${customers.creditLimit}
        )`.mapWith(Number),
      })
      .from(customers),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        date: invoices.date,
        customerName: invoices.customerName,
        grandTotal: invoices.grandTotal,
        status: invoices.status,
      })
      .from(invoices)
      .orderBy(desc(invoices.createdAt), desc(invoices.id))
      .limit(5),
  ]);

  return {
    sales: salesRows[0] ?? { today: 0, todayCount: 0, month: 0, monthCount: 0 },
    owed: owedRows[0] ?? { receivable: 0, owingCount: 0, overLimit: 0 },
    recent,
  };
}

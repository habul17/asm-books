import "server-only";

import { and, between, eq, gte, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import {
  bills,
  creditNoteLines,
  creditNotes,
  expenses,
  invoiceLines,
  invoices,
  payments,
  products,
  purchaseOrders,
  salesDocs,
  vendors,
} from "@/db/schema";
import { AGING_BUCKETS } from "@/lib/reports/aging";
import type { Period } from "@/lib/reports/period";
import { isOwner, requireUser } from "@/server/auth";

import { todayInIndia } from "./invoice-writes";
import { loadPaymentProfits } from "./payment-profit";
import { arAging } from "./receivables";
import {
  gstSummary,
  lowStockWhere,
  profitAndLoss,
  salesByCustomer,
  salesByItem,
  slowStockWhere,
  vendorBalances,
} from "./reports";
import { loadBusiness } from "./settings";
import { moneyToday } from "./statements";
import { inStockIds, stockCosts } from "./stock";
import { vendorBalance } from "./vendors";

const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
const sum = (expr: SQL) => sql<number>`coalesce(sum(${expr}), 0)`.mapWith(Number);
const count = () => sql<number>`count(*)`.mapWith(Number);

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const period = (from: string, to: string): Period => ({ from, to, preset: "custom", label: "" });

/** This month so far, and the same days of last month to compare it with. */
function monthPeriods(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const ly = m === 1 ? y - 1 : y;
  const lm = m === 1 ? 12 : m - 1;
  const lastDay = new Date(Date.UTC(ly, lm, 0)).getUTCDate();
  return {
    current: period(`${y}-${pad(m)}-01`, today),
    previous: period(`${ly}-${pad(lm)}-01`, `${ly}-${pad(lm)}-${pad(Math.min(d, lastDay))}`),
  };
}

/** The last `n` months as YYYY-MM, oldest first, ending with this month. */
function lastMonths(today: string, n: number): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const t = y * 12 + (m - 1) - (n - 1 - i);
    return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
  });
}

/** Sales, purchases and expenses (all with GST) for a period. */
async function monthFigures(p: Period) {
  const db = getDb();
  const rows = await db.batch([
    db
      .select({ value: sum(sql`${invoices.grandTotal}`) })
      .from(invoices)
      .where(and(eq(invoices.status, "final"), between(invoices.date, p.from, p.to))),
    db
      .select({ value: sum(sql`${bills.grandTotal}`) })
      .from(bills)
      .where(and(eq(bills.status, "final"), between(bills.date, p.from, p.to))),
    db
      .select({ value: sum(sql`${expenses.amount}`) })
      .from(expenses)
      .where(and(eq(expenses.status, "final"), between(expenses.date, p.from, p.to))),
  ]);
  const [sales, purchases, spent] = rows.map((r) => round2(r[0]?.value ?? 0));
  return { sales, purchases, expenses: spent };
}

/**
 * Unpaid vendor bills by due date. Payments are not tied to bills, so they pay off
 * the oldest bills first and the newest ones are the unpaid ones (as for customers).
 */
async function payablesDue(today: string) {
  const db = getDb();
  const ranked = db
    .select({
      vendorId: bills.vendorId,
      dueDate: bills.dueDate,
      grandTotal: bills.grandTotal,
      newer: sql<number>`(sum(${bills.grandTotal}) OVER (
        PARTITION BY ${bills.vendorId} ORDER BY ${bills.date} DESC, ${bills.id} DESC
      ) - ${bills.grandTotal})`.as("newer"),
    })
    .from(bills)
    .where(eq(bills.status, "final"))
    .as("ranked");
  const unpaid = sql`least(${ranked.grandTotal}, ${vendorBalance} - ${ranked.newer})`;
  const [row] = await db
    .select({
      overdue: sql<number>`coalesce(sum(${unpaid}) FILTER (WHERE ${ranked.dueDate} < ${today}), 0)`.mapWith(Number),
      dueThisWeek: sql<number>`coalesce(sum(${unpaid}) FILTER (
        WHERE ${ranked.dueDate} BETWEEN ${today} AND ${addDays(today, 7)}
      ), 0)`.mapWith(Number),
    })
    .from(ranked)
    .innerJoin(vendors, eq(vendors.id, ranked.vendorId))
    .where(sql`${ranked.newer} < ${vendorBalance}`);
  return { overdue: round2(row?.overdue ?? 0), dueThisWeek: round2(row?.dueThisWeek ?? 0) };
}

/** Stock and open orders. Staff see the counts; values are only shown to the owner. */
async function stockAndOrders(today: string) {
  const db = getDb();
  const { defaultMinStock } = await loadBusiness();
  const [stock, low, slow, orders, pos] = await db.batch([
    db
      .select({ parts: sql<number>`count(*) FILTER (WHERE ${products.stockQty} > 0)`.mapWith(Number) })
      .from(products)
      .where(eq(products.active, true)),
    db
      .select({
        low: count(),
        out: sql<number>`count(*) FILTER (WHERE ${products.stockQty} <= 0)`.mapWith(Number),
      })
      .from(products)
      .where(lowStockWhere(defaultMinStock)),
    db
      .select({ id: products.id })
      .from(products)
      .where(slowStockWhere(today)),
    db
      .select({ count: count(), value: sum(sql`${salesDocs.grandTotal}`) })
      .from(salesDocs)
      .where(and(eq(salesDocs.kind, "order"), eq(salesDocs.status, "open"))),
    db
      .select({ count: count(), value: sum(sql`${purchaseOrders.grandTotal}`) })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.status, "open")),
  ]);
  // What the stock actually cost: each purchase bill's pieces at that bill's price.
  const costs = await stockCosts(await inStockIds());
  const valueOf = (ids: number[]) => round2(ids.reduce((v, id) => v + (costs.get(id)?.value ?? 0), 0));
  return {
    stock: {
      value: valueOf([...costs.keys()]),
      parts: stock[0]?.parts ?? 0,
      low: low[0]?.low ?? 0,
      out: low[0]?.out ?? 0,
      slowCount: slow.length,
      slowValue: valueOf(slow.map((r) => r.id)),
    },
    orders: {
      sales: { count: orders[0]?.count ?? 0, value: round2(orders[0]?.value ?? 0) },
      purchase: { count: pos[0]?.count ?? 0, value: round2(pos[0]?.value ?? 0) },
    },
  };
}

/** Today's sales and money received, and sales and purchases for each of `months`. */
async function salesFigures(today: string, months: string[]) {
  const db = getDb();
  const since = `${months[0]}-01`;
  const month = (date: typeof invoices.date | typeof bills.date) => sql<string>`to_char(${date}, 'YYYY-MM')`;
  const [todaySales, todayReceived, monthlySales, monthlyBought] = await db.batch([
    db
      .select({
        value: sum(sql`${invoices.grandTotal}`),
        count: count(),
        cash: sql<number>`coalesce(sum(${invoices.grandTotal}) FILTER (WHERE ${invoices.paymentType} = 'cash'), 0)`.mapWith(
          Number,
        ),
      })
      .from(invoices)
      .where(and(eq(invoices.status, "final"), eq(invoices.date, today))),
    db
      .select({ value: sum(sql`${payments.amount}`), count: count() })
      .from(payments)
      .where(and(eq(payments.status, "final"), eq(payments.date, today))),
    db
      .select({ month: month(invoices.date), value: sum(sql`${invoices.grandTotal}`) })
      .from(invoices)
      .where(and(eq(invoices.status, "final"), gte(invoices.date, since)))
      .groupBy(month(invoices.date)),
    db
      .select({ month: month(bills.date), value: sum(sql`${bills.grandTotal}`) })
      .from(bills)
      .where(and(eq(bills.status, "final"), gte(bills.date, since)))
      .groupBy(month(bills.date)),
  ]);
  const byMonth = (rows: { month: string; value: number }[]) => new Map(rows.map((r) => [r.month, round2(r.value)]));
  const sold = byMonth(monthlySales);
  const bought = byMonth(monthlyBought);
  return {
    today: {
      sales: round2(todaySales[0]?.value ?? 0),
      invoices: todaySales[0]?.count ?? 0,
      /** Cash sales and payments received: all the money that came in today. */
      received: round2((todaySales[0]?.cash ?? 0) + (todayReceived[0]?.value ?? 0)),
      cashSales: round2(todaySales[0]?.cash ?? 0),
      payments: todayReceived[0]?.count ?? 0,
    },
    chart: months.map((m) => ({ month: m, sales: sold.get(m) ?? 0, purchases: bought.get(m) ?? 0 })),
  };
}

/**
 * Profit from the money that actually came in during a period: cash sales, less cash
 * refunded for returns, plus the profit each payment received carried (payments settle
 * the oldest credit bills first). Money for old dues, advances or bills without a
 * purchase cost carries no known profit and is reported as `untraced`.
 */
async function profitReceived(p: Period) {
  const db = getDb();
  const inPeriod = (date: typeof invoices.date | typeof creditNotes.date | typeof payments.date) =>
    between(date, p.from, p.to);
  const [cashSales, cashRefunds, paid] = await db.batch([
    db
      .select({
        total: invoices.grandTotal,
        // Null when any row has no purchase cost: profit is then not known.
        profit: sql<number | null>`case when bool_and(${invoiceLines.cost} is not null)
          then ${invoices.taxableTotal} - sum(${invoiceLines.cost} * ${invoiceLines.qty}) end`.mapWith((v) =>
          v == null ? null : Number(v),
        ),
      })
      .from(invoices)
      .innerJoin(invoiceLines, eq(invoiceLines.invoiceId, invoices.id))
      .where(and(eq(invoices.status, "final"), eq(invoices.paymentType, "cash"), inPeriod(invoices.date)))
      .groupBy(invoices.id),
    db
      .select({
        total: creditNotes.grandTotal,
        // Profit given back: the sale value refunded, less the cost of parts put back on the shelf.
        profit: sql<number | null>`case when not ${creditNotes.restocked} then ${creditNotes.taxableTotal}
          when bool_and(${creditNoteLines.cost} is not null)
          then ${creditNotes.taxableTotal} - sum(${creditNoteLines.cost} * ${creditNoteLines.qty}) end`.mapWith((v) =>
          v == null ? null : Number(v),
        ),
      })
      .from(creditNotes)
      .innerJoin(creditNoteLines, eq(creditNoteLines.creditNoteId, creditNotes.id))
      .where(and(eq(creditNotes.status, "final"), eq(creditNotes.refundType, "cash"), inPeriod(creditNotes.date)))
      .groupBy(creditNotes.id),
    db
      .select({ id: payments.id, customerId: payments.customerId, amount: payments.amount })
      .from(payments)
      .where(and(eq(payments.status, "final"), inPeriod(payments.date))),
  ]);
  const settled = await loadPaymentProfits(
    db,
    paid.map((r) => r.customerId),
  );
  let profit = 0;
  let untraced = 0;
  for (const s of cashSales) {
    if (s.profit == null) untraced += s.total;
    else profit += s.profit;
  }
  for (const r of cashRefunds) {
    if (r.profit == null) untraced -= r.total;
    else profit -= r.profit;
  }
  for (const r of paid) {
    const s = settled.get(r.id);
    if (!s) untraced += r.amount;
    else {
      profit += s.profit;
      untraced += s.untraced;
    }
  }
  const cash = round2(cashSales.reduce((t, s) => t + s.total, 0) - cashRefunds.reduce((t, r) => t + r.total, 0));
  const payment = round2(paid.reduce((t, r) => t + r.amount, 0));
  return {
    cashSales: cash,
    payments: payment,
    received: round2(cash + payment),
    profit: round2(profit),
    untraced: round2(Math.max(untraced, 0)),
  };
}

/** Everything about money on the Home screen; only for the owner. */
/** Photo ids of these parts, by part id. */
async function partPhotos(ids: number[]) {
  if (!ids.length) return new Map<number, string>();
  const rows = await getDb()
    .select({ id: products.id, photo: products.photo })
    .from(products)
    .where(and(inArray(products.id, ids), isNotNull(products.photo)));
  return new Map(rows.map((r) => [r.id, r.photo as string]));
}

async function ownerFigures(today: string) {
  const { current, previous } = monthPeriods(today);
  const [sales, now, before, profitNow, profitBefore, owed, owing, due, money, gst, items, buyers, earned] = await Promise.all([
    salesFigures(today, lastMonths(today, 6)),
    monthFigures(current),
    monthFigures(previous),
    profitAndLoss(current),
    profitAndLoss(previous),
    arAging(),
    vendorBalances(),
    payablesDue(today),
    moneyToday(),
    gstSummary(current),
    salesByItem(current, 5000),
    salesByCustomer(current),
    profitReceived(current),
  ]);
  const gstOf = (t: { cgst: number; sgst: number; igst: number }) => round2(t.cgst + t.sgst + t.igst);
  const topParts = items.items
    .filter((r) => r.productId != null && r.qty > 0)
    .sort((a, b) => b.qty - a.qty || b.taxable - a.taxable)
    .slice(0, 5);
  const photos = await partPhotos(topParts.map((r) => r.productId as number));
  return {
    today: sales.today,
    chart: sales.chart,
    month: {
      /** The same days of last month that this month is compared with. */
      comparedTo: previous,
      now: { ...now, profit: profitNow.net },
      before: { ...before, profit: profitBefore.net },
    },
    /** Profit from money received this month, shared half and half between the two partners. */
    earned: { ...earned, ashi: round2(earned.profit / 2), dad: round2(earned.profit - round2(earned.profit / 2)) },
    receivable: {
      total: owed.total,
      customers: owed.rows.length,
      buckets: AGING_BUCKETS.map((b, i) => ({ label: b.label, value: owed.totals[i] ?? 0 })),
    },
    payable: { total: owing.owed, vendors: owing.items.filter((v) => v.balance > 0).length, ...due },
    money: { cash: money.cash, bank: money.bank, total: money.total, openingSet: money.openingSet },
    gst: { output: gstOf(gst.output), input: gstOf(gst.input), payable: gstOf(gst.payable) },
    topParts: topParts.map((r) => ({
      id: r.productId as number,
      partNo: r.partNo,
      description: r.description,
      unit: r.unit,
      qty: r.qty,
      photo: photos.get(r.productId as number) ?? null,
    })),
    topCustomers: buyers.items
      .filter((r) => r.net > 0)
      .slice(0, 5)
      .map((r) => ({ id: r.customerId, name: r.name, value: r.net, count: r.count })),
  };
}

/** Numbers for the Home screen. Staff see stock and open-order counts only. */
export async function getHomeDashboard() {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  const today = todayInIndia();
  const owner = isOwner(user);
  const [{ stock, orders }, figures] = await Promise.all([stockAndOrders(today), owner ? ownerFigures(today) : null]);
  if (owner) return { today, owner, stock, orders, figures };
  // Staff never receive money values, not even hidden ones.
  return {
    today,
    owner,
    stock: { ...stock, value: null, slowValue: null },
    orders: { sales: { count: orders.sales.count, value: null }, purchase: { count: orders.purchase.count, value: null } },
    figures,
  };
}

export type HomeDashboard = Awaited<ReturnType<typeof getHomeDashboard>>;

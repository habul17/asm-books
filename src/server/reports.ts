import "server-only";

import { and, asc, between, desc, eq, gt, isNotNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { col } from "@/db/sql";
import {
  bills,
  creditNoteLines,
  creditNotes,
  customers,
  expenses,
  invoiceLines,
  invoices,
  payments,
  products,
  stockAdjustmentLines,
  stockAdjustments,
  stockMovements,
  vendorPayments,
  vendors,
} from "@/db/schema";
import { parsePeriod, type Period } from "@/lib/reports/period";
import { requireOwner, requireUser } from "@/server/auth";

import { customerBalance } from "./customers";
import { todayInIndia } from "./invoice-writes";
import { vendorBalance } from "./vendors";

/** Sum of a numeric SQL expression as a JS number (0 when there are no rows). */
const total = (expr: SQL) => sql<number>`coalesce(sum(${expr}), 0)`.mapWith(Number);
/** Like total, but only over the rows matching `where`. */
const totalWhere = (expr: SQL, where: SQL) =>
  sql<number>`coalesce(sum(${expr}) FILTER (WHERE ${where}), 0)`.mapWith(Number);
const rowCount = () => sql<number>`count(*)`.mapWith(Number);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Reason that only records stock already on the shelf, so it is not a profit or a loss. */
const OPENING_STOCK = "Opening stock";

/** The report period from the page's search params, as seen today in India. */
export async function readPeriod(params: { period?: string; from?: string; to?: string }): Promise<Period> {
  await connection(); // "Today" must be read at request time.
  return parsePeriod(params, todayInIndia());
}

const invoiceInPeriod = (p: Period) => and(eq(invoices.status, "final"), between(invoices.date, p.from, p.to));
const returnInPeriod = (p: Period) => and(eq(creditNotes.status, "final"), between(creditNotes.date, p.from, p.to));

/** Sales and returns for the period, money received, and a day-by-day breakdown. */
export async function salesSummary(period: Period) {
  await requireOwner();
  const db = getDb();
  const gst = sql`${invoices.cgstTotal} + ${invoices.sgstTotal} + ${invoices.igstTotal}`;
  const cnGst = sql`${creditNotes.cgstTotal} + ${creditNotes.sgstTotal} + ${creditNotes.igstTotal}`;
  const [salesRows, returnRows, receivedRows, salesDays, returnDays] = await db.batch([
    db
      .select({
        count: rowCount(),
        taxable: total(sql`${invoices.taxableTotal}`),
        gst: total(gst),
        total: total(sql`${invoices.grandTotal}`),
        cash: totalWhere(sql`${invoices.grandTotal}`, sql`${invoices.paymentType} = 'cash'`),
        credit: totalWhere(sql`${invoices.grandTotal}`, sql`${invoices.paymentType} = 'credit'`),
      })
      .from(invoices)
      .where(invoiceInPeriod(period)),
    db
      .select({
        count: rowCount(),
        taxable: total(sql`${creditNotes.taxableTotal}`),
        gst: total(cnGst),
        total: total(sql`${creditNotes.grandTotal}`),
      })
      .from(creditNotes)
      .where(returnInPeriod(period)),
    db
      .select({ mode: payments.mode, count: rowCount(), amount: total(sql`${payments.amount}`) })
      .from(payments)
      .where(and(eq(payments.status, "final"), between(payments.date, period.from, period.to)))
      .groupBy(payments.mode)
      .orderBy(desc(sql`sum(${payments.amount})`)),
    db
      .select({ date: invoices.date, count: rowCount(), total: total(sql`${invoices.grandTotal}`) })
      .from(invoices)
      .where(invoiceInPeriod(period))
      .groupBy(invoices.date),
    db
      .select({ date: creditNotes.date, total: total(sql`${creditNotes.grandTotal}`) })
      .from(creditNotes)
      .where(returnInPeriod(period))
      .groupBy(creditNotes.date),
  ]);

  const days = new Map<string, { date: string; count: number; sales: number; returns: number }>();
  for (const d of salesDays) days.set(d.date, { date: d.date, count: d.count, sales: d.total, returns: 0 });
  for (const d of returnDays) {
    const day = days.get(d.date) ?? { date: d.date, count: 0, sales: 0, returns: 0 };
    day.returns = d.total;
    days.set(d.date, day);
  }

  const sales = salesRows[0] ?? { count: 0, taxable: 0, gst: 0, total: 0, cash: 0, credit: 0 };
  const returns = returnRows[0] ?? { count: 0, taxable: 0, gst: 0, total: 0 };
  return {
    sales,
    returns,
    net: { taxable: round2(sales.taxable - returns.taxable), total: round2(sales.total - returns.total) },
    received: receivedRows,
    days: [...days.values()].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** Sales per customer for the period, less their returns. Walk-in sales are one row. */
export async function salesByCustomer(period: Period) {
  await requireOwner();
  const db = getDb();
  const [sold, returned] = await db.batch([
    db
      .select({
        customerId: invoices.customerId,
        name: sql<string>`coalesce(max(${customers.name}), 'Walk-in customers')`,
        count: rowCount(),
        taxable: total(sql`${invoices.taxableTotal}`),
        total: total(sql`${invoices.grandTotal}`),
      })
      .from(invoices)
      .leftJoin(customers, eq(customers.id, invoices.customerId))
      .where(invoiceInPeriod(period))
      .groupBy(invoices.customerId),
    db
      .select({
        customerId: creditNotes.customerId,
        name: sql<string>`coalesce(max(${customers.name}), 'Walk-in customers')`,
        taxable: total(sql`${creditNotes.taxableTotal}`),
        total: total(sql`${creditNotes.grandTotal}`),
      })
      .from(creditNotes)
      .leftJoin(customers, eq(customers.id, creditNotes.customerId))
      .where(returnInPeriod(period))
      .groupBy(creditNotes.customerId),
  ]);

  const rows = new Map<string, { customerId: number | null; name: string; count: number; sales: number; returns: number; netTaxable: number }>();
  const key = (id: number | null) => (id == null ? "walk-in" : String(id));
  for (const s of sold) {
    rows.set(key(s.customerId), { customerId: s.customerId, name: s.name, count: s.count, sales: s.total, returns: 0, netTaxable: s.taxable });
  }
  for (const r of returned) {
    const row = rows.get(key(r.customerId)) ?? { customerId: r.customerId, name: r.name, count: 0, sales: 0, returns: 0, netTaxable: 0 };
    row.returns = r.total;
    row.netTaxable = round2(row.netTaxable - r.taxable);
    rows.set(key(r.customerId), row);
  }
  const items = [...rows.values()]
    .map((r) => ({ ...r, net: round2(r.sales - r.returns) }))
    .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
  return {
    items,
    totals: {
      sales: round2(items.reduce((s, r) => s + r.sales, 0)),
      returns: round2(items.reduce((s, r) => s + r.returns, 0)),
      net: round2(items.reduce((s, r) => s + r.net, 0)),
    },
  };
}

export const ITEM_REPORT_LIMIT = 300;

/** Quantity, sales (before GST), cost and profit per part for the period, less returns. */
export async function salesByItem(period: Period) {
  await requireOwner();
  const db = getDb();
  const [sold, returned] = await db.batch([
    db
      .select({
        productId: invoiceLines.productId,
        partNo: sql<string | null>`max(${invoiceLines.partNo})`,
        description: sql<string>`max(${invoiceLines.description})`,
        unit: sql<string>`max(${invoiceLines.unit})`,
        qty: total(sql`${invoiceLines.qty}`),
        taxable: total(sql`${invoiceLines.taxable}`),
        cost: total(sql`${invoiceLines.qty} * ${invoiceLines.cost}`),
        noCost: totalWhere(sql`${invoiceLines.taxable}`, sql`${invoiceLines.cost} IS NULL`),
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(invoiceInPeriod(period))
      // One row per part; free-text lines (no part) group by their description.
      .groupBy(invoiceLines.productId, sql`CASE WHEN ${invoiceLines.productId} IS NULL THEN ${invoiceLines.description} END`),
    db
      .select({
        productId: creditNoteLines.productId,
        partNo: sql<string | null>`max(${creditNoteLines.partNo})`,
        description: sql<string>`max(${creditNoteLines.description})`,
        unit: sql<string>`max(${creditNoteLines.unit})`,
        qty: total(sql`${creditNoteLines.qty}`),
        taxable: total(sql`${creditNoteLines.taxable}`),
        // Only parts put back on the shelf come off the cost; damaged ones stay a cost.
        cost: totalWhere(sql`${creditNoteLines.qty} * ${creditNoteLines.cost}`, sql`${creditNotes.restocked}`),
        noCost: totalWhere(sql`${creditNoteLines.taxable}`, sql`${creditNoteLines.cost} IS NULL`),
      })
      .from(creditNoteLines)
      .innerJoin(creditNotes, eq(creditNotes.id, creditNoteLines.creditNoteId))
      .where(returnInPeriod(period))
      .groupBy(
        creditNoteLines.productId,
        sql`CASE WHEN ${creditNoteLines.productId} IS NULL THEN ${creditNoteLines.description} END`,
      ),
  ]);

  type Row = { productId: number | null; partNo: string | null; description: string; unit: string; qty: number; taxable: number; cost: number; noCost: number };
  const rows = new Map<string, Row>();
  const key = (r: { productId: number | null; description: string }) => (r.productId == null ? `d:${r.description}` : `p:${r.productId}`);
  for (const s of sold) rows.set(key(s), { ...s });
  for (const r of returned) {
    const row = rows.get(key(r)) ?? { ...r, qty: 0, taxable: 0, cost: 0, noCost: 0 };
    row.qty -= r.qty;
    row.taxable -= r.taxable;
    row.cost -= r.cost;
    row.noCost -= r.noCost;
    rows.set(key(r), row);
  }
  const all = [...rows.values()]
    .map((r) => ({
      ...r,
      qty: Math.round(r.qty * 1000) / 1000,
      taxable: round2(r.taxable),
      cost: round2(r.cost),
      noCost: round2(r.noCost),
      profit: round2(r.taxable - r.cost - r.noCost),
    }))
    .sort((a, b) => b.taxable - a.taxable || a.description.localeCompare(b.description));
  return {
    count: all.length,
    items: all.slice(0, ITEM_REPORT_LIMIT),
    totals: {
      taxable: round2(all.reduce((s, r) => s + r.taxable, 0)),
      cost: round2(all.reduce((s, r) => s + r.cost, 0)),
      noCost: round2(all.reduce((s, r) => s + r.noCost, 0)),
    },
  };
}

/** Expenses for the period, per category. `amount` is before GST (claimable GST is not a cost). */
export async function expensesByCategory(period: Period) {
  await requireOwner();
  const net = sql`${expenses.amount} - ${expenses.cgst} - ${expenses.sgst} - ${expenses.igst}`;
  const rows = await getDb()
    .select({
      category: sql<string>`min(${expenses.category})`,
      count: rowCount(),
      amount: total(net),
      gst: total(sql`${expenses.cgst} + ${expenses.sgst} + ${expenses.igst}`),
    })
    .from(expenses)
    .where(and(eq(expenses.status, "final"), between(expenses.date, period.from, period.to)))
    .groupBy(sql`lower(${expenses.category})`)
    .orderBy(desc(sql`sum(${net})`));
  return {
    items: rows,
    total: round2(rows.reduce((s, r) => s + r.amount, 0)),
    gst: round2(rows.reduce((s, r) => s + r.gst, 0)),
  };
}

/**
 * Profit and loss for the period, all before GST:
 * sales − returns − cost of parts sold = gross profit; then − expenses ± stock written off or found.
 */
export async function profitAndLoss(period: Period) {
  await requireOwner();
  const db = getDb();
  const [items, spent, adjRows] = await Promise.all([
    salesByItem(period),
    expensesByCategory(period),
    db
      .select({
        lost: totalWhere(sql`${stockAdjustmentLines.qty} * ${stockAdjustmentLines.cost}`, sql`${stockAdjustmentLines.qty} < 0`),
        found: totalWhere(sql`${stockAdjustmentLines.qty} * ${stockAdjustmentLines.cost}`, sql`${stockAdjustmentLines.qty} > 0`),
        noCostLines: sql<number>`count(*) FILTER (WHERE ${stockAdjustmentLines.cost} IS NULL)`.mapWith(Number),
      })
      .from(stockAdjustmentLines)
      .innerJoin(stockAdjustments, eq(stockAdjustments.id, stockAdjustmentLines.adjustmentId))
      .where(
        and(
          eq(stockAdjustments.status, "final"),
          between(stockAdjustments.date, period.from, period.to),
          ne(stockAdjustments.reason, OPENING_STOCK),
        ),
      ),
  ]);
  const adj = adjRows[0] ?? { lost: 0, found: 0, noCostLines: 0 };
  const sales = items.totals.taxable;
  const costOfSales = items.totals.cost;
  const gross = round2(sales - costOfSales);
  const stockLost = round2(-adj.lost);
  const stockFound = round2(adj.found);
  return {
    sales,
    costOfSales,
    /** Sales (before GST) of lines whose part had no purchase price, so their cost counts as 0. */
    salesWithoutCost: items.totals.noCost,
    gross,
    expenses: spent.items,
    expensesTotal: spent.total,
    stockLost,
    stockFound,
    adjustmentLinesWithoutCost: adj.noCostLines,
    net: round2(gross - spent.total - stockLost + stockFound),
  };
}

/** Output GST (sales less returns) against input GST (purchase bills) for the period. */
export async function gstSummary(period: Period) {
  await requireOwner();
  const db = getDb();
  const [out, back, input, spent, byRate, byRateBack] = await db.batch([
    db
      .select({
        count: rowCount(),
        taxable: total(sql`${invoices.taxableTotal}`),
        cgst: total(sql`${invoices.cgstTotal}`),
        sgst: total(sql`${invoices.sgstTotal}`),
        igst: total(sql`${invoices.igstTotal}`),
      })
      .from(invoices)
      .where(invoiceInPeriod(period)),
    db
      .select({
        count: rowCount(),
        taxable: total(sql`${creditNotes.taxableTotal}`),
        cgst: total(sql`${creditNotes.cgstTotal}`),
        sgst: total(sql`${creditNotes.sgstTotal}`),
        igst: total(sql`${creditNotes.igstTotal}`),
      })
      .from(creditNotes)
      .where(returnInPeriod(period)),
    db
      .select({
        count: rowCount(),
        taxable: total(sql`${bills.taxableTotal}`),
        cgst: total(sql`${bills.cgstTotal}`),
        sgst: total(sql`${bills.sgstTotal}`),
        igst: total(sql`${bills.igstTotal}`),
      })
      .from(bills)
      .where(and(eq(bills.status, "final"), between(bills.date, period.from, period.to))),
    db
      .select({
        count: rowCount(),
        taxable: total(sql`${expenses.amount} - ${expenses.cgst} - ${expenses.sgst} - ${expenses.igst}`),
        cgst: total(sql`${expenses.cgst}`),
        sgst: total(sql`${expenses.sgst}`),
        igst: total(sql`${expenses.igst}`),
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.status, "final"),
          sql`${expenses.gstRate} > 0`,
          between(expenses.date, period.from, period.to),
        ),
      ),
    db
      .select({
        rate: invoiceLines.gstRate,
        taxable: total(sql`${invoiceLines.taxable}`),
        tax: total(sql`${invoiceLines.cgst} + ${invoiceLines.sgst} + ${invoiceLines.igst}`),
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(invoiceInPeriod(period))
      .groupBy(invoiceLines.gstRate),
    db
      .select({
        rate: creditNoteLines.gstRate,
        taxable: total(sql`${creditNoteLines.taxable}`),
        tax: total(sql`${creditNoteLines.cgst} + ${creditNoteLines.sgst} + ${creditNoteLines.igst}`),
      })
      .from(creditNoteLines)
      .innerJoin(creditNotes, eq(creditNotes.id, creditNoteLines.creditNoteId))
      .where(returnInPeriod(period))
      .groupBy(creditNoteLines.gstRate),
  ]);

  const zero = { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  const sales = out[0] ?? zero;
  const returns = back[0] ?? zero;
  const bought = input[0] ?? zero;
  const expenseGst = spent[0] ?? zero;
  const purchases = {
    count: bought.count + expenseGst.count,
    taxable: round2(bought.taxable + expenseGst.taxable),
    cgst: round2(bought.cgst + expenseGst.cgst),
    sgst: round2(bought.sgst + expenseGst.sgst),
    igst: round2(bought.igst + expenseGst.igst),
  };
  const minus = (a: typeof zero, b: typeof zero) => ({
    taxable: round2(a.taxable - b.taxable),
    cgst: round2(a.cgst - b.cgst),
    sgst: round2(a.sgst - b.sgst),
    igst: round2(a.igst - b.igst),
  });
  const output = minus(sales, returns);
  const rates = new Map<number, { rate: number; taxable: number; tax: number }>();
  for (const r of byRate) rates.set(r.rate, { ...r });
  for (const r of byRateBack) {
    const row = rates.get(r.rate) ?? { rate: r.rate, taxable: 0, tax: 0 };
    row.taxable = round2(row.taxable - r.taxable);
    row.tax = round2(row.tax - r.tax);
    rates.set(r.rate, row);
  }
  return {
    sales,
    returns,
    output,
    input: purchases,
    /** Part of `input` that came from purchase bills and from expenses with GST. */
    inputFromBills: bought,
    inputFromExpenses: expenseGst,
    payable: minus({ ...output, count: 0 }, purchases),
    byRate: [...rates.values()].sort((a, b) => a.rate - b.rate),
  };
}

/** Customers who owe us money or have paid in advance, biggest balance first. */
export async function customerBalances() {
  await connection(); // Always read live data; never prerender at build time.
  await requireOwner();
  const rows = await getDb()
    .select({
      id: customers.id,
      name: customers.name,
      mobile: customers.mobile,
      city: customers.city,
      creditLimit: customers.creditLimit,
      balance: customerBalance,
    })
    .from(customers)
    .where(sql`abs(${customerBalance}) >= 0.005`)
    .orderBy(desc(customerBalance), asc(customers.name));
  return {
    items: rows,
    owed: round2(rows.reduce((s, r) => s + Math.max(r.balance, 0), 0)),
    advance: round2(rows.reduce((s, r) => s + Math.max(-r.balance, 0), 0)),
  };
}

/** Vendors we owe money to or have paid in advance, biggest balance first. */
export async function vendorBalances() {
  await connection(); // Always read live data; never prerender at build time.
  await requireOwner();
  const db = getDb();
  const lastPaid = sql<string | null>`(
    SELECT max(${col(vendorPayments.date)}) FROM ${vendorPayments}
    WHERE ${col(vendorPayments.vendorId)} = ${col(vendors.id)} AND ${col(vendorPayments.status)} = 'final'
  )`;
  const rows = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      mobile: vendors.mobile,
      city: vendors.city,
      lastPaid,
      balance: vendorBalance,
    })
    .from(vendors)
    .where(sql`abs(${vendorBalance}) >= 0.005`)
    .orderBy(desc(vendorBalance), asc(vendors.name));
  return {
    items: rows,
    owed: round2(rows.reduce((s, r) => s + Math.max(r.balance, 0), 0)),
    advance: round2(rows.reduce((s, r) => s + Math.max(-r.balance, 0), 0)),
  };
}

export const LOW_STOCK_LIMIT = 500;

/**
 * Parts to reorder: at or below their minimum stock, or out of stock after having been
 * stocked or sold before (parts never stocked are left out, or all 1,283 would show).
 */
export async function lowStock() {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const moved = sql`EXISTS (SELECT 1 FROM ${stockMovements} WHERE ${col(stockMovements.productId)} = ${col(products.id)})`;
  const rows = await getDb()
    .select({
      id: products.id,
      partNo: products.partNo,
      description: products.description,
      unit: products.unit,
      stockQty: products.stockQty,
      minStock: products.minStock,
    })
    .from(products)
    .where(
      and(
        eq(products.active, true),
        or(
          and(isNotNull(products.minStock), gt(products.minStock, 0), lte(products.stockQty, products.minStock)),
          lt(products.stockQty, 0),
          and(lte(products.stockQty, 0), moved),
        ),
      ),
    )
    .orderBy(asc(products.stockQty), asc(products.partNo))
    .limit(LOW_STOCK_LIMIT + 1);
  return { items: rows.slice(0, LOW_STOCK_LIMIT), more: rows.length > LOW_STOCK_LIMIT };
}

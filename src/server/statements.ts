import "server-only";

import { and, between, eq, lt, lte, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { connection } from "next/server";

import { getDb } from "@/db";
import { col } from "@/db/sql";
import {
  bills,
  creditNotes,
  customers,
  expenses,
  invoices,
  payments,
  products,
  purchasePrices,
  purchaseReturns,
  stockMovements,
  vendorPayments,
  vendors,
} from "@/db/schema";
import type { Period } from "@/lib/reports/period";
import { buildBalanceSheet, buildCashFlow, cashTotals, fyStart, parseAsOf, type CashMoves } from "@/lib/reports/statements";
import { requireOwner } from "@/server/auth";

import { todayInIndia } from "./invoice-writes";
import { profitAndLoss } from "./reports";
import { loadBusiness } from "./settings";

const total = (expr: SQL) => sql<number>`coalesce(sum(${expr}), 0)`.mapWith(Number);
const sumOf = (rows: { value: number }[]) => rows[0]?.value ?? 0;

/** The balance sheet date from the page's search params, as seen today in India. */
export async function readAsOf(raw: string | undefined) {
  await connection(); // "Today" must be read at request time.
  const today = todayInIndia();
  return { asOf: parseAsOf(raw, today), today };
}

/** Money in and out on the dates `when` accepts. No auth check: callers have checked the owner. */
async function cashMoves(when: (date: PgColumn) => SQL | undefined): Promise<CashMoves> {
  const db = getDb();
  const [cashSales, received, paid, spent, refunds] = await db.batch([
    db
      .select({ value: total(sql`${invoices.grandTotal}`) })
      .from(invoices)
      .where(and(eq(invoices.status, "final"), eq(invoices.paymentType, "cash"), when(invoices.date))),
    db
      .select({ value: total(sql`${payments.amount}`) })
      .from(payments)
      .where(and(eq(payments.status, "final"), when(payments.date))),
    db
      .select({ value: total(sql`${vendorPayments.amount}`) })
      .from(vendorPayments)
      .where(and(eq(vendorPayments.status, "final"), when(vendorPayments.date))),
    db
      .select({ value: total(sql`${expenses.amount}`) })
      .from(expenses)
      .where(and(eq(expenses.status, "final"), when(expenses.date))),
    db
      .select({ value: total(sql`${creditNotes.grandTotal}`) })
      .from(creditNotes)
      .where(and(eq(creditNotes.status, "final"), eq(creditNotes.refundType, "cash"), when(creditNotes.date))),
  ]);
  return {
    cashSales: sumOf(cashSales),
    received: sumOf(received),
    paidToVendors: sumOf(paid),
    expenses: sumOf(spent),
    refunds: sumOf(refunds),
  };
}

/**
 * Money that came in and went out in the period, with the cash and bank balance
 * before and after. The balance counts from the opening figure in Settings.
 */
export async function cashFlow(period: Period) {
  await requireOwner();
  const [business, before, during] = await Promise.all([
    loadBusiness(),
    cashMoves((date) => lt(date, period.from)),
    cashMoves((date) => between(date, period.from, period.to)),
  ]);
  return buildCashFlow(during, business.openingCash + cashTotals(before).net);
}

/** What a customer owed on a date: opening balance, credit invoices, less payments and credited returns. */
const customerBalanceAt = (asOf: string) => sql<number>`(${col(customers.openingBalance)} + coalesce((
  SELECT sum(${col(invoices.grandTotal)}) FROM ${invoices}
  WHERE ${col(invoices.customerId)} = ${col(customers.id)} AND ${col(invoices.status)} = 'final'
    AND ${col(invoices.paymentType)} = 'credit' AND ${col(invoices.date)} <= ${asOf}
), 0) - coalesce((
  SELECT sum(${col(payments.amount)}) FROM ${payments}
  WHERE ${col(payments.customerId)} = ${col(customers.id)} AND ${col(payments.status)} = 'final'
    AND ${col(payments.date)} <= ${asOf}
), 0) - coalesce((
  SELECT sum(${col(creditNotes.grandTotal)}) FROM ${creditNotes}
  WHERE ${col(creditNotes.customerId)} = ${col(customers.id)} AND ${col(creditNotes.status)} = 'final'
    AND ${col(creditNotes.refundType)} = 'credit' AND ${col(creditNotes.date)} <= ${asOf}
), 0))`;

/** What we owed a vendor on a date: opening balance and bills, less payments and goods sent back. */
const vendorBalanceAt = (asOf: string) => sql<number>`(${col(vendors.openingBalance)} + coalesce((
  SELECT sum(${col(bills.grandTotal)}) FROM ${bills}
  WHERE ${col(bills.vendorId)} = ${col(vendors.id)} AND ${col(bills.status)} = 'final'
    AND ${col(bills.date)} <= ${asOf}
), 0) - coalesce((
  SELECT sum(${col(vendorPayments.amount)}) FROM ${vendorPayments}
  WHERE ${col(vendorPayments.vendorId)} = ${col(vendors.id)} AND ${col(vendorPayments.status)} = 'final'
    AND ${col(vendorPayments.date)} <= ${asOf}
), 0) - coalesce((
  SELECT sum(${col(purchaseReturns.grandTotal)}) FROM ${purchaseReturns}
  WHERE ${col(purchaseReturns.vendorId)} = ${col(vendors.id)} AND ${col(purchaseReturns.status)} = 'final'
    AND ${col(purchaseReturns.date)} <= ${asOf}
), 0))`;

/** Stock a part had at the end of a date: today's stock with later movements undone. */
const stockQtyAt = (asOf: string) => sql`(${col(products.stockQty)} - coalesce((
  SELECT sum(${col(stockMovements.qty)}) FROM ${stockMovements}
  WHERE ${col(stockMovements.productId)} = ${col(products.id)} AND ${col(stockMovements.date)} > ${asOf}
), 0))`;

/** A part's purchase price on a date; a part first priced later is valued at its first price. */
const purchasePriceAt = (asOf: string) => sql`coalesce((
  SELECT ${col(purchasePrices.price)} FROM ${purchasePrices}
  WHERE ${col(purchasePrices.productId)} = ${col(products.id)} AND ${col(purchasePrices.date)} <= ${asOf}
  ORDER BY ${col(purchasePrices.date)} DESC, ${col(purchasePrices.id)} DESC LIMIT 1
), (
  SELECT ${col(purchasePrices.price)} FROM ${purchasePrices}
  WHERE ${col(purchasePrices.productId)} = ${col(products.id)}
  ORDER BY ${col(purchasePrices.date)}, ${col(purchasePrices.id)} LIMIT 1
))`;

/**
 * What the business has and owes at the end of `asOf`. The owner's capital is
 * the difference, so the two sides always agree.
 */
export async function balanceSheet(asOf: string) {
  await requireOwner();
  const db = getDb();
  const owed = customerBalanceAt(asOf);
  const owing = vendorBalanceAt(asOf);
  const qty = stockQtyAt(asOf);
  const price = purchasePriceAt(asOf);
  const upTo = (date: PgColumn) => lte(date, asOf);
  const gst = (t: { cgstTotal: PgColumn; sgstTotal: PgColumn; igstTotal: PgColumn }) =>
    total(sql`${t.cgstTotal} + ${t.sgstTotal} + ${t.igstTotal}`);

  const [business, moves, profit, rows] = await Promise.all([
    loadBusiness(),
    cashMoves(upTo),
    profitAndLoss({ from: fyStart(asOf), to: asOf, preset: "custom", label: "" }),
    db.batch([
      db
        .select({
          owed: total(sql`greatest(${owed}, 0)`),
          advances: total(sql`greatest(-${owed}, 0)`),
        })
        .from(customers),
      db
        .select({
          owing: total(sql`greatest(${owing}, 0)`),
          advances: total(sql`greatest(-${owing}, 0)`),
        })
        .from(vendors),
      db
        .select({
          value: total(sql`greatest(${qty}, 0) * coalesce(${price}, 0)`),
          withoutPrice: sql<number>`count(*) FILTER (WHERE ${qty} > 0 AND ${price} IS NULL)`.mapWith(Number),
          belowZero: sql<number>`count(*) FILTER (WHERE ${qty} < 0)`.mapWith(Number),
        })
        .from(products),
      db.select({ value: gst(invoices) }).from(invoices).where(and(eq(invoices.status, "final"), upTo(invoices.date))),
      db
        .select({ value: gst(creditNotes) })
        .from(creditNotes)
        .where(and(eq(creditNotes.status, "final"), upTo(creditNotes.date))),
      db.select({ value: gst(bills) }).from(bills).where(and(eq(bills.status, "final"), upTo(bills.date))),
      db
        .select({ value: gst(purchaseReturns) })
        .from(purchaseReturns)
        .where(and(eq(purchaseReturns.status, "final"), upTo(purchaseReturns.date))),
      db
        .select({ value: total(sql`${expenses.cgst} + ${expenses.sgst} + ${expenses.igst}`) })
        .from(expenses)
        .where(and(eq(expenses.status, "final"), upTo(expenses.date))),
    ]),
  ]);
  const [customerRows, vendorRows, stockRows, gstSales, gstReturns, gstBills, gstSentBack, gstExpenses] = rows;
  const stock = stockRows[0] ?? { value: 0, withoutPrice: 0, belowZero: 0 };

  return {
    asOf,
    fyFrom: fyStart(asOf),
    openingCash: business.openingCash,
    /** Parts in stock that have no purchase price, so they are valued at ₹0. */
    stockWithoutPrice: stock.withoutPrice,
    /** Parts whose stock is below zero; they are valued at ₹0. */
    stockBelowZero: stock.belowZero,
    ...buildBalanceSheet({
      cash: business.openingCash + cashTotals(moves).net,
      receivables: customerRows[0]?.owed ?? 0,
      customerAdvances: customerRows[0]?.advances ?? 0,
      payables: vendorRows[0]?.owing ?? 0,
      vendorAdvances: vendorRows[0]?.advances ?? 0,
      stock: stock.value,
      gstOutput: sumOf(gstSales) - sumOf(gstReturns),
      gstInput: sumOf(gstBills) - sumOf(gstSentBack) + sumOf(gstExpenses),
      profitThisYear: profit.net,
    }),
  };
}

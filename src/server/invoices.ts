import "server-only";

import { and, asc, desc, eq, getTableColumns, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import {
  categories,
  customerGroups,
  customers,
  invoiceLines,
  invoices,
  priceListItems,
  priceLists,
  products,
  users,
} from "@/db/schema";
import { shownExtra } from "@/lib/custom-fields";
import { computePrice } from "@/lib/pricing";
import { col } from "@/db/sql";
import { requireUser } from "@/server/auth";
import { loadBusiness } from "@/server/settings";

import { loadCustomFields } from "./custom-fields";
import { customerBalance } from "./customers";
import { productSearch, purchasePriceAt } from "./product-search";
import { canChangeInvoice } from "@/lib/invoices/edit-window";

export const INVOICE_LIMIT = 100;
const PICK_LIMIT = 15;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type InvoiceStatusFilter = "all" | "final" | "cancelled";

export interface InvoiceFilters {
  query: string;
  status: InvoiceStatusFilter;
  customerId: number | null;
}

/** Every word must appear in the invoice number, customer name or mobile. */
export async function searchInvoices(filters: InvoiceFilters, limit = INVOICE_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [
    filters.status === "all" ? undefined : eq(invoices.status, filters.status),
    filters.customerId ? eq(invoices.customerId, filters.customerId) : undefined,
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(ilike(invoices.number, like), ilike(invoices.customerName, like), ilike(invoices.customerMobile, like)),
    );
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        total: sql<number>`coalesce(sum(${invoices.grandTotal}) FILTER (WHERE ${invoices.status} = 'final'), 0)`.mapWith(
          Number,
        ),
      })
      .from(invoices)
      .where(where),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        date: invoices.date,
        customerId: invoices.customerId,
        customerName: invoices.customerName,
        paymentType: invoices.paymentType,
        grandTotal: invoices.grandTotal,
        status: invoices.status,
      })
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.date), desc(invoices.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, total: summary[0]?.total ?? 0, items };
}

export type InvoiceListItem = Awaited<ReturnType<typeof searchInvoices>>["items"][number];

/** Line columns without the purchase cost, which never leaves the server. */
const lineColumns = Object.fromEntries(
  Object.entries(getTableColumns(invoiceLines)).filter(([key]) => key !== "cost"),
) as Omit<ReturnType<typeof getTableColumns<typeof invoiceLines>>, "cost">;

/** One invoice with its lines. Profit is only included for the owner. */
export async function getInvoice(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = getDb();
  const [heads, lines] = await db.batch([
    db
      .select({ invoice: invoices, priceListName: priceLists.name, createdByName: users.name })
      .from(invoices)
      .leftJoin(priceLists, eq(priceLists.id, invoices.priceListId))
      .leftJoin(users, eq(users.id, invoices.createdBy))
      .where(eq(invoices.id, id)),
    db
      .select({ line: lineColumns, cost: invoiceLines.cost, stockQty: products.stockQty })
      .from(invoiceLines)
      .leftJoin(products, eq(products.id, invoiceLines.productId))
      .where(eq(invoiceLines.invoiceId, id))
      .orderBy(asc(invoiceLines.lineNo)),
  ]);
  const head = heads[0];
  if (!head) return null;
  const hasExtra = Object.keys(head.invoice.extra).length > 0;
  const fields = hasExtra ? await loadCustomFields("invoice", db) : [];
  const isOwner = user.role === "owner";
  const allCosted = lines.every((l) => l.cost != null);
  const cost = lines.reduce((s, l) => s + (l.cost ?? 0) * l.line.qty, 0);
  return {
    ...head.invoice,
    priceListName: head.priceListName,
    createdByName: head.createdByName,
    /** Filled-in custom fields, as printed on the invoice. */
    shownExtra: shownExtra(fields, head.invoice.extra),
    // Costs stay on the server; only the profit total is shared, and only with the owner.
    lines: lines.map(({ line, stockQty }) => ({ ...line, stockQty })),
    profit: isOwner && allCosted ? Math.round((head.invoice.taxableTotal - cost) * 100) / 100 : null,
    /** Staff may change an invoice only on the day it was made. */
    canChange: canChangeInvoice(isOwner, head.invoice.createdAt),
  };
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

/** What the invoice editor needs besides the invoice itself. */
export async function getEditorOptions() {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const db = getDb();
  const [business, fields, lists] = await Promise.all([
    loadBusiness(db),
    loadCustomFields("invoice", db),
    db
      .select({ id: priceLists.id, name: priceLists.name, enabled: priceLists.enabled })
      .from(priceLists)
      .where(isNull(priceLists.deletedAt))
      .orderBy(asc(priceLists.sort), asc(priceLists.id)),
  ]);
  return {
    businessReady: business.name !== "",
    sellerState: business.stateCode || null,
    defaultGstRate: business.defaultGstRate,
    defaultPriceListId: business.defaultPriceListId,
    allowWalkIn: business.allowWalkIn,
    priceLists: lists,
    /** Custom fields that are switched on, in the order they are shown. */
    fields: fields.filter((f) => f.active),
  };
}

export type EditorOptions = Awaited<ReturnType<typeof getEditorOptions>>;

const pickedCustomerColumns = {
  id: customers.id,
  name: customers.name,
  city: customers.city,
  mobile: customers.mobile,
  stateCode: customers.stateCode,
  priceListId: sql<number | null>`coalesce(${customers.priceListId}, ${customerGroups.priceListId})`,
  creditLimit: customers.creditLimit,
  balance: customerBalance,
};

/** Customers matching the words, for the invoice's customer picker. */
export async function pickCustomers(query: string) {
  await requireUser();
  const words = query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [eq(customers.active, true)];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(ilike(customers.name, like), ilike(customers.mobile, like), ilike(customers.city, like), ilike(customers.gstin, like)),
    );
  }
  return getDb()
    .select(pickedCustomerColumns)
    .from(customers)
    .leftJoin(customerGroups, eq(customerGroups.id, customers.groupId))
    .where(and(...conditions))
    .orderBy(sql`lower(${customers.name})`)
    .limit(PICK_LIMIT);
}

/** One customer as the invoice editor shows them (also switched-off ones, for old invoices). */
export async function pickCustomerById(id: number) {
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb()
    .select(pickedCustomerColumns)
    .from(customers)
    .leftJoin(customerGroups, eq(customerGroups.id, customers.groupId))
    .where(eq(customers.id, id));
  return row ?? null;
}

export type PickedCustomer = Awaited<ReturnType<typeof pickCustomers>>[number];

async function loadList(listId: number | null) {
  if (listId == null) return null;
  const [list] = await getDb()
    .select()
    .from(priceLists)
    .where(and(eq(priceLists.id, listId), isNull(priceLists.deletedAt)));
  return list ?? null;
}

const itemColumns = (listId: number) => ({
  id: products.id,
  partNo: products.partNo,
  description: products.description,
  unit: products.unit,
  gstRate: products.gstRate,
  stockQty: products.stockQty,
  list: products.listPrice,
  purchase: purchasePriceAt(0),
  previousPurchase: purchasePriceAt(1),
  manualPrice: sql<number | null>`(
    SELECT ${col(priceListItems.manualPrice)} FROM ${priceListItems}
    WHERE ${col(priceListItems.productId)} = ${col(products.id)} AND ${col(priceListItems.priceListId)} = ${listId}
  )`.mapWith(Number),
});

interface ItemRow {
  id: number;
  partNo: string;
  description: string;
  unit: string;
  gstRate: number | null;
  stockQty: number;
  list: number | null;
  purchase: number | null;
  previousPurchase: number | null;
  manualPrice: number | null;
}

/** Selling price from the list (or the product's list price without one). Purchase prices never leave the server. */
function toPickedItem(p: ItemRow, list: Awaited<ReturnType<typeof loadList>>, defaultGstRate: number) {
  const price = list
    ? computePrice(list, { purchase: p.purchase, previous_purchase: p.previousPurchase, list: p.list }, p.manualPrice)
        .price
    : p.list;
  return {
    id: p.id,
    partNo: p.partNo,
    description: p.description,
    unit: p.unit,
    gstRate: p.gstRate ?? defaultGstRate,
    stockQty: p.stockQty,
    price,
  };
}

export type PickedItem = ReturnType<typeof toPickedItem>;

/** Products matching the search, priced for the chosen price list. */
export async function pickItems(query: string, priceListId: number | null) {
  await requireUser();
  const db = getDb();
  const [list, business] = await Promise.all([loadList(priceListId), loadBusiness(db)]);
  const { where, rank } = productSearch(query);
  const rows = await db
    .select(itemColumns(list?.id ?? 0))
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(rank, asc(products.sort), asc(products.id))
    .limit(PICK_LIMIT);
  return rows.map((r) => toPickedItem(r, list, business.defaultGstRate));
}

/** Current prices of the given products in a price list, for re-pricing the lines of an invoice. */
export async function priceItems(productIds: number[], priceListId: number | null) {
  await requireUser();
  const ids = [...new Set(productIds)].filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 300);
  if (!ids.length) return [];
  const db = getDb();
  const [list, business] = await Promise.all([loadList(priceListId), loadBusiness(db)]);
  const rows = await db
    .select(itemColumns(list?.id ?? 0))
    .from(products)
    .where(inArray(products.id, ids));
  return rows.map((r) => toPickedItem(r, list, business.defaultGstRate));
}

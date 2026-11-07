import "server-only";

import { connection } from "next/server";

import { and, asc, count, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import { col } from "@/db/sql";
import { requireUser } from "@/server/auth";
import { customerGroups, customers, customFields, invoices, payments, priceLists } from "@/db/schema";
import type { CustomFieldDef } from "@/lib/customers/validation";
import { GST_STATES } from "@/lib/gst";

export const CUSTOMER_LIMIT = 100;
const MAX_WORDS = 8;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * What the customer owes us right now. Positive: they owe us; negative: they paid in advance.
 * Opening balance, plus credit invoices, minus payments received (cancelled ones are ignored).
 * Credit notes are taken off here once they are built.
 */
export const customerBalance = sql<number>`(${col(customers.openingBalance)} + coalesce((
  SELECT sum(${col(invoices.grandTotal)}) FROM ${invoices}
  WHERE ${col(invoices.customerId)} = ${col(customers.id)}
    AND ${col(invoices.status)} = 'final' AND ${col(invoices.paymentType)} = 'credit'
), 0) - coalesce((
  SELECT sum(${col(payments.amount)}) FROM ${payments}
  WHERE ${col(payments.customerId)} = ${col(customers.id)} AND ${col(payments.status)} = 'final'
), 0))`.mapWith(Number);
const balance = customerBalance;

export interface CustomerFilters {
  query: string;
  showInactive: boolean;
  groupId: number | null;
}

/** Every word must appear in the name, mobile, GSTIN, city or contact person. */
export async function searchCustomers(filters: CustomerFilters, limit = CUSTOMER_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [
    filters.showInactive ? undefined : eq(customers.active, true),
    filters.groupId ? eq(customers.groupId, filters.groupId) : undefined,
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(
        ilike(customers.name, like),
        ilike(customers.mobile, like),
        ilike(customers.gstin, like),
        ilike(customers.city, like),
        ilike(customers.contactPerson, like),
      ),
    );
  }
  const where = and(...conditions);
  const db = getDb();

  const [countRows, items] = await db.batch([
    db.select({ total: count() }).from(customers).where(where),
    db
      .select({
        id: customers.id,
        name: customers.name,
        mobile: customers.mobile,
        city: customers.city,
        gstin: customers.gstin,
        active: customers.active,
        creditLimit: customers.creditLimit,
        groupName: customerGroups.name,
        balance,
      })
      .from(customers)
      .leftJoin(customerGroups, eq(customerGroups.id, customers.groupId))
      .where(where)
      .orderBy(sql`lower(${customers.name})`, asc(customers.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);

  return { total: countRows[0]?.total ?? 0, items };
}

export type CustomerListItem = Awaited<ReturnType<typeof searchCustomers>>["items"][number];

export async function getCustomer(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = getDb();

  const rows = await db
    .select({
      customer: customers,
      groupName: customerGroups.name,
      groupPriceListId: customerGroups.priceListId,
      balance,
    })
    .from(customers)
    .leftJoin(customerGroups, eq(customerGroups.id, customers.groupId))
    .where(eq(customers.id, id));
  const row = rows[0];
  if (!row) return null;

  const c = row.customer;
  const effectiveListId = c.priceListId ?? row.groupPriceListId;
  const list = effectiveListId
    ? (
        await db
          .select({ id: priceLists.id, name: priceLists.name, enabled: priceLists.enabled })
          .from(priceLists)
          .where(and(eq(priceLists.id, effectiveListId), isNull(priceLists.deletedAt)))
      )[0]
    : undefined;

  return {
    ...c,
    groupName: row.groupName,
    stateName: c.stateCode ? (GST_STATES[c.stateCode] ?? null) : null,
    balance: row.balance,
    overCreditLimit: c.creditLimit != null && row.balance > c.creditLimit,
    priceList: list ? { ...list, fromGroup: c.priceListId == null } : null,
  };
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

/** Groups, live price lists and custom fields: everything the customer form needs. */
export async function getCustomerOptions() {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const db = getDb();
  const [groups, lists, fields] = await db.batch([
    db
      .select({
        id: customerGroups.id,
        name: customerGroups.name,
        priceListId: customerGroups.priceListId,
        customerCount: sql<number>`(
          SELECT count(*) FROM ${customers} WHERE ${col(customers.groupId)} = ${col(customerGroups.id)}
        )`.mapWith(Number),
      })
      .from(customerGroups)
      .orderBy(sql`lower(${customerGroups.name})`),
    db
      .select({ id: priceLists.id, name: priceLists.name, enabled: priceLists.enabled })
      .from(priceLists)
      .where(isNull(priceLists.deletedAt))
      .orderBy(asc(priceLists.sort), asc(priceLists.id)),
    db
      .select({ id: customFields.id, label: customFields.label, type: customFields.type, active: customFields.active })
      .from(customFields)
      .where(eq(customFields.entity, "customer"))
      .orderBy(asc(customFields.sort), asc(customFields.id)),
  ]);
  return { groups, priceLists: lists, fields: fields satisfies CustomFieldDef[] };
}

export type CustomerOptions = Awaited<ReturnType<typeof getCustomerOptions>>;

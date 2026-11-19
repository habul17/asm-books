"use server";

import { and, asc, count, eq, isNull, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import {
  creditNotes,
  customerGroups,
  customers,
  customFields,
  invoices,
  payments,
  priceLists,
  recurringInvoices,
  salesDocs,
} from "@/db/schema";
import { customersHref } from "@/lib/customers/href";
import { groupSchema, parseCustomer } from "@/lib/customers/validation";
import { isOwner, requireUser } from "@/server/auth";
import { scanContact } from "@/server/bill-scan/contact";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import type { ContactDraft } from "@/lib/contacts/scan";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();
const FAILED = "Could not save. Please try again.";

function logError(action: string, err: unknown) {
  console.error(`[customers] ${action} failed:`, err instanceof Error ? err.message : err);
}

async function groupExists(id: number | null) {
  if (id == null) return true;
  const rows = await getDb().select({ id: customerGroups.id }).from(customerGroups).where(eq(customerGroups.id, id));
  return rows.length > 0;
}

async function priceListExists(id: number | null) {
  if (id == null) return true;
  const rows = await getDb()
    .select({ id: priceLists.id })
    .from(priceLists)
    .where(and(eq(priceLists.id, id), isNull(priceLists.deletedAt)));
  return rows.length > 0;
}

async function groupNameTaken(name: string, exceptId: number | null) {
  const rows = await getDb()
    .select({ id: customerGroups.id })
    .from(customerGroups)
    .where(
      and(
        eq(sql`lower(${customerGroups.name})`, name.toLowerCase()),
        exceptId ? ne(customerGroups.id, exceptId) : undefined,
      ),
    );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** Creates a customer (id null) or updates one. */
export async function saveCustomer(id: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (id != null && !idSchema.safeParse(id).success) return { error: "Invalid customer" };
  const db = getDb();
  let savedId: number;

  try {
    const [fields, current] = await db.batch([
      db
        .select({ id: customFields.id, label: customFields.label, type: customFields.type, active: customFields.active })
        .from(customFields)
        .where(eq(customFields.entity, "customer"))
        .orderBy(asc(customFields.sort)),
      db
        .select({ id: customers.id, extra: customers.extra })
        .from(customers)
        .where(eq(customers.id, id ?? 0)),
    ]);
    if (id != null && current.length === 0) return { error: "Customer not found" };

    const form = Object.fromEntries(formData);
    // A new customer is always active; the checkbox only shows when editing.
    if (id == null) form.active = "on";
    const parsed = parseCustomer(form, fields, current[0]?.extra ?? {});
    if (!parsed.value) return { error: parsed.error };
    const value = parsed.value;

    if (!(await groupExists(value.groupId))) return { error: "Customer group not found" };
    if (!(await priceListExists(value.priceListId))) return { error: "Price list not found" };

    if (id == null) {
      const [row] = await db.insert(customers).values(value).returning({ id: customers.id });
      savedId = row.id;
    } else {
      await db.update(customers).set(value).where(eq(customers.id, id));
      savedId = id;
    }
  } catch (err) {
    logError("saveCustomer", err);
    return { error: FAILED };
  }
  redirect(customersHref({ id: savedId }));
}

export interface DeleteCustomerState extends ActionState {
  /** True when the customer has history, so it can only be made inactive. */
  hasHistory?: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Deletes a customer with no history. One with invoices, payments, returns,
 * quotes or recurring invoices is kept, because old bills must not change.
 */
export async function deleteCustomer(id: number): Promise<DeleteCustomerState> {
  if (!isOwner(await requireUser())) return { error: "Only the owner can delete customers." };
  if (!idSchema.safeParse(id).success) return { error: "Invalid customer" };
  const db = getDb();
  try {
    const [[inv], [pay], [cn], [docs], [rec]] = await db.batch([
      db.select({ n: count() }).from(invoices).where(eq(invoices.customerId, id)),
      db.select({ n: count() }).from(payments).where(eq(payments.customerId, id)),
      db.select({ n: count() }).from(creditNotes).where(eq(creditNotes.customerId, id)),
      db.select({ n: count() }).from(salesDocs).where(eq(salesDocs.customerId, id)),
      db.select({ n: count() }).from(recurringInvoices).where(eq(recurringInvoices.customerId, id)),
    ]);
    const history = [
      inv.n && plural(inv.n, "invoice"),
      pay.n && plural(pay.n, "payment"),
      cn.n && plural(cn.n, "credit note"),
      docs.n && plural(docs.n, "quote or order"),
      rec.n && plural(rec.n, "recurring invoice"),
    ].filter(Boolean);
    if (history.length > 0) {
      return {
        error: `This customer has ${history.join(", ")}, so it cannot be deleted. You can make it inactive: it is hidden from search and its bills stay.`,
        hasHistory: true,
      };
    }
    const deleted = await db.delete(customers).where(eq(customers.id, id)).returning({ id: customers.id });
    if (deleted.length === 0) return { error: "Customer not found" };
  } catch (err) {
    logError("deleteCustomer", err);
    return { error: FAILED };
  }
  redirect(customersHref({}));
}

/** Hides a customer from search; its history is kept. */
export async function deactivateCustomer(id: number): Promise<ActionState> {
  if (!isOwner(await requireUser())) return { error: "Only the owner can do this." };
  if (!idSchema.safeParse(id).success) return { error: "Invalid customer" };
  try {
    const done = await getDb()
      .update(customers)
      .set({ active: false })
      .where(eq(customers.id, id))
      .returning({ id: customers.id });
    if (done.length === 0) return { error: "Customer not found" };
  } catch (err) {
    logError("deactivateCustomer", err);
    return { error: FAILED };
  }
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function createGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = groupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    if (await groupNameTaken(parsed.data.name, null)) return { error: "A group with this name already exists" };
    if (!(await priceListExists(parsed.data.priceListId))) return { error: "Price list not found" };
    await getDb().insert(customerGroups).values(parsed.data);
  } catch (err) {
    logError("createGroup", err);
    return { error: FAILED };
  }
  refresh();
  return { ok: true };
}

export async function updateGroup(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Invalid group" };
  const parsed = groupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    if (await groupNameTaken(parsed.data.name, id)) return { error: "A group with this name already exists" };
    if (!(await priceListExists(parsed.data.priceListId))) return { error: "Price list not found" };
    const updated = await getDb()
      .update(customerGroups)
      .set(parsed.data)
      .where(eq(customerGroups.id, id))
      .returning({ id: customerGroups.id });
    if (updated.length === 0) return { error: "Group not found" };
  } catch (err) {
    logError("updateGroup", err);
    return { error: FAILED };
  }
  refresh();
  return { ok: true };
}

/** Only groups without customers can be deleted. */
export async function deleteGroup(id: number): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Invalid group" };
  const db = getDb();
  try {
    const used = await db.select({ id: customers.id }).from(customers).where(eq(customers.groupId, id)).limit(1);
    if (used.length > 0) return { error: "Move the customers out of this group first" };
    const deleted = await db
      .delete(customerGroups)
      .where(eq(customerGroups.id, id))
      .returning({ id: customerGroups.id });
    if (deleted.length === 0) return { error: "Group not found" };
  } catch (err) {
    logError("deleteGroup", err);
    return { error: FAILED };
  }
  refresh();
  return { ok: true };
}

/** Reads a visiting card, GST certificate or letterhead and returns details to check. Nothing is saved. */
export async function scanContactAction(formData: FormData): Promise<ScanAnswer<ContactDraft>> {
  await requireUser();
  return scanUpload(formData, "card", (file) => scanContact(file, "customer"));
}

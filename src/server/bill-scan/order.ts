import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { customers, products } from "@/db/schema";
import { partKey } from "@/lib/bills/scan";
import { ORDER_INSTRUCTIONS, ORDER_JSON_SCHEMA, orderLineLabel, orderQty, scannedOrderSchema } from "@/lib/invoices/order-scan";
import { matchParty } from "@/lib/payments/scan";
import { pickCustomerById, pickItems, priceItems, type PickedCustomer, type PickedItem } from "@/server/invoices";
import { loadBusiness } from "@/server/settings";

import { readDocument } from "./index";
import { BillScanError, type BillFile } from "./reader";

const ORDER_TASK = {
  noun: "order",
  ask: "Read the items ordered in this document.",
  instructions: ORDER_INSTRUCTIONS,
  schema: ORDER_JSON_SCHEMA,
};

export interface OrderRow {
  item: PickedItem;
  qty: number;
}

export interface OrderScanResult {
  /** The ordering customer, when one saved customer matches what is written. */
  customer: PickedCustomer | null;
  /** The price list the rows are priced with. */
  priceListId: number | null;
  rows: OrderRow[];
  warnings: string[];
}

/** The one active part a written row means: same part number, else a search with exactly one fitting answer. */
async function findPart(
  line: { partNo: string | null; description: string | null },
  byKey: Map<string, number[]>,
  listId: number | null,
): Promise<{ id: number; sure: boolean } | { choices: string[] } | null> {
  const key = line.partNo ? partKey(line.partNo) : "";
  const exact = key ? byKey.get(key) : undefined;
  if (exact?.length === 1) return { id: exact[0], sure: true };
  const query = (line.partNo ?? line.description ?? "").trim();
  if (query.length < 3) return null;
  const found = await pickItems(query, listId);
  if (found.length === 1) return { id: found[0].id, sure: false };
  // Several hits: keep the one part whose name has every word written, if there is just one.
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  const full = found.filter((f) => {
    const name = `${f.partNo} ${f.description}`.toLowerCase();
    return words.every((w) => name.includes(w));
  });
  if (full.length === 1) return { id: full[0].id, sure: false };
  const close = full.length ? full : found;
  return close.length ? { choices: close.map((f) => f.partNo) } : null;
}

/**
 * Reads a customer's order and prepares rows for a new sales bill, priced with the
 * customer's price list (or `formListId` when no customer matches). When the bill already has
 * a customer (`chosenCustomerId`) they are kept, and the bill's price list is used. Nothing is saved.
 * The caller must have checked the user.
 */
export async function scanOrder(
  file: BillFile,
  { listId: formListId, chosenCustomerId }: { listId: number | null; chosenCustomerId: number | null },
): Promise<OrderScanResult> {
  const parsed = scannedOrderSchema.safeParse(await readDocument(file, ORDER_TASK));
  if (!parsed.success) throw new BillScanError("The order could not be read. Try a clearer photo.");
  const order = parsed.data;
  const warnings = [...order.doubts];
  if (!order.lines.length) warnings.push("No items were found on the order.");

  const db = getDb();
  const [parts, people, business] = await Promise.all([
    db.select({ id: products.id, partNo: products.partNo }).from(products).where(eq(products.active, true)),
    order.customerName || order.customerPhone
      ? db.select({ id: customers.id, name: customers.name, mobile: customers.mobile }).from(customers).where(eq(customers.active, true))
      : [],
    loadBusiness(db),
  ]);

  const customerId = matchParty(order.customerName, order.customerPhone, people);
  let customer: PickedCustomer | null = null;
  if (chosenCustomerId != null) {
    if (customerId != null && customerId !== chosenCustomerId) {
      const named = people.find((p) => p.id === customerId)?.name;
      warnings.push(`This order looks like it is from ${named}, not the customer chosen on the bill. Check the customer.`);
    }
  } else {
    customer = customerId ? await pickCustomerById(customerId) : null;
    if (!customer && order.customerName) warnings.push(`The order is from "${order.customerName}". Choose the customer.`);
  }
  const listId = customer ? (customer.priceListId ?? business.defaultPriceListId) : formListId;

  const byKey = new Map<string, number[]>();
  for (const p of parts) {
    const k = partKey(p.partNo);
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), p.id]);
  }

  const wanted: { id: number; qty: number }[] = [];
  for (const [i, line] of order.lines.entries()) {
    const label = orderLineLabel(line, i + 1);
    const part = await findPart(line, byKey, listId);
    if (!part) {
      warnings.push(`${label}: not found in your parts. Add it with the item search.`);
      continue;
    }
    if ("choices" in part) {
      const some = part.choices.slice(0, 4).join(", ") + (part.choices.length > 4 ? "…" : "");
      warnings.push(`${label}: ${part.choices.length} parts fit (${some}). Add the right one with the item search.`);
      continue;
    }
    const qty = orderQty(line.qty);
    if (qty == null) warnings.push(`${label}: quantity unclear, 1 was put. Check the quantity.`);
    if (!part.sure) warnings.push(`${label}: matched by search. Check it is the right part.`);
    wanted.push({ id: part.id, qty: qty ?? 1 });
  }

  const items = new Map((await priceItems(wanted.map((w) => w.id), listId)).map((it) => [it.id, it]));
  // The same part written twice becomes one row with both quantities.
  const rows = new Map<number, OrderRow>();
  for (const w of wanted) {
    const item = items.get(w.id);
    if (!item) continue;
    const row = rows.get(w.id);
    if (row) row.qty = Math.round((row.qty + w.qty) * 1000) / 1000;
    else rows.set(w.id, { item, qty: w.qty });
  }
  for (const r of rows.values()) {
    if (r.qty > r.item.stockQty) {
      warnings.push(`${r.item.partNo}: ${r.qty} ordered but only ${r.item.stockQty} in stock.`);
    }
  }
  return { customer, priceListId: listId, rows: [...rows.values()], warnings };
}

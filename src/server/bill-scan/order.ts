import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { ORDER_INSTRUCTIONS, ORDER_JSON_SCHEMA, orderLineLabel, orderQty, scannedOrderSchema } from "@/lib/invoices/order-scan";
import { matchParty } from "@/lib/payments/scan";
import { pickCustomerById, pickItems, priceItems, type PickedCustomer, type PickedItem } from "@/server/invoices";
import { loadBusiness } from "@/server/settings";

import { findPart, partKeys } from "./find-part";
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
  const [byKey, people, business] = await Promise.all([
    partKeys(),
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

  const wanted: { id: number; qty: number }[] = [];
  for (const [i, line] of order.lines.entries()) {
    const label = orderLineLabel(line, i + 1);
    const part = await findPart(line, byKey, (q) => pickItems(q, listId));
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

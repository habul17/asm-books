import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { withTransaction, type Tx } from "@/db";
import { billLines, bills, products, purchasePrices, vendors } from "@/db/schema";
import type { BillInput } from "@/lib/bills/validation";
import { calcInvoice, taxTypeFor } from "@/lib/invoices/math";
import { loadBusiness } from "@/server/settings";

import { moveStock, qtyByProduct, todayInIndia } from "./invoice-writes";

/** A problem with what the user entered; the message is safe to show. */
export class BillInputError extends Error {}

interface ExistingBill {
  id: number;
  vendorId: number;
  lines: { productId: number | null; qty: number }[];
}

/** Rate after discount: what one unit really cost, kept to 6 decimals. */
const netRate = (rate: number, discountPct: number) => Math.round(rate * (1 - discountPct / 100) * 1e6) / 1e6;

/** Checks the input against the database and works out every amount. */
async function prepare(tx: Tx, input: BillInput, existing: ExistingBill | null) {
  const business = await loadBusiness(tx);
  const [vendor] = await tx.select().from(vendors).where(eq(vendors.id, input.vendorId));
  if (!vendor) throw new BillInputError("Vendor not found. Please choose again.");
  if (!vendor.active && vendor.id !== existing?.vendorId) {
    throw new BillInputError("This vendor is switched off. Turn them on in Vendors first.");
  }

  // The same vendor bill must not be entered twice.
  const [dup] = await tx
    .select({ id: bills.id })
    .from(bills)
    .where(
      and(
        eq(bills.vendorId, vendor.id),
        eq(sql`lower(${bills.billNo})`, input.billNo.toLowerCase()),
        eq(bills.status, "final"),
        existing ? ne(bills.id, existing.id) : undefined,
      ),
    )
    .limit(1);
  if (dup) throw new BillInputError(`Bill ${input.billNo} from ${vendor.name} is already entered.`);

  const ids = [...new Set(input.lines.map((l) => l.productId).filter((id): id is number => id != null))];
  const found = ids.length
    ? await tx
        .select({ id: products.id, partNo: products.partNo, hsn: products.hsn, unit: products.unit })
        .from(products)
        .where(inArray(products.id, ids))
    : [];
  const byId = new Map(found.map((p) => [p.id, p]));

  const lines = input.lines.map((l, i) => {
    const p = l.productId != null ? byId.get(l.productId) : undefined;
    if (l.productId != null && !p) throw new BillInputError(`Item ${i + 1}: this part no longer exists.`);
    const qty = Math.round(l.qty * 1000) / 1000;
    if (qty <= 0) throw new BillInputError(`Item ${i + 1}: quantity must be more than 0`);
    return {
      lineNo: i + 1,
      productId: l.productId,
      partNo: p?.partNo ?? null,
      description: l.description,
      hsn: p?.hsn ?? null,
      unit: p?.unit ?? "Nos",
      qty,
      rate: l.rate,
      discountPct: l.discountPct,
      gstRate: l.gstRate,
    };
  });

  const taxType = taxTypeFor(business.stateCode || null, vendor.stateCode || business.stateCode || null);
  const { lines: calculated, totals } = calcInvoice(lines, taxType, { round: input.roundTotal });
  const header = {
    vendorId: vendor.id,
    billNo: input.billNo,
    date: input.date,
    dueDate: input.dueDate,
    taxType,
    updatePrices: input.updatePrices,
    notes: input.notes || null,
    ...totals,
  };
  return { vendor, header, lines: calculated };
}

/** Makes this bill's rates the parts' newest purchase prices (price lists follow them). */
async function recordPrices(
  tx: Tx,
  billId: number,
  info: { date: string; vendorName: string; billNo: string },
  lines: { productId: number | null; rate: number; discountPct: number }[],
) {
  const rows = lines
    .filter((l): l is typeof l & { productId: number } => l.productId != null)
    .map((l) => ({
      productId: l.productId,
      price: netRate(l.rate, l.discountPct),
      date: info.date,
      supplier: info.vendorName,
      billRef: info.billNo,
      source: `bill:${billId}`,
    }));
  if (rows.length) await tx.insert(purchasePrices).values(rows);
}

const removePrices = (tx: Tx, billId: number) =>
  tx.delete(purchasePrices).where(eq(purchasePrices.source, `bill:${billId}`));

export async function createBill(input: BillInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    const { vendor, header, lines } = await prepare(tx, input, null);
    const [{ id }] = await tx
      .insert(bills)
      .values({ ...header, createdBy: userId })
      .returning({ id: bills.id });
    await tx.insert(billLines).values(lines.map((l) => ({ ...l, billId: id })));
    await moveStock(tx, qtyByProduct(lines), { kind: "purchase", billId: id, date: header.date, note: header.billNo, userId });
    if (header.updatePrices) await recordPrices(tx, id, { ...header, vendorName: vendor.name }, lines);
    return id;
  });
}

async function lockBill(tx: Tx, id: number) {
  const [bill] = await tx
    .select({ id: bills.id, vendorId: bills.vendorId, billNo: bills.billNo, status: bills.status })
    .from(bills)
    .where(eq(bills.id, id))
    .for("update");
  if (!bill) throw new BillInputError("Bill not found.");
  if (bill.status === "cancelled") throw new BillInputError("This bill is cancelled and cannot be changed.");
  const lines = await tx
    .select({ productId: billLines.productId, qty: billLines.qty })
    .from(billLines)
    .where(eq(billLines.billId, id));
  return { ...bill, lines };
}

export async function updateBill(id: number, input: BillInput, userId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const existing = await lockBill(tx, id);
    const { vendor, header, lines } = await prepare(tx, input, existing);
    await tx.update(bills).set(header).where(eq(bills.id, id));
    await tx.delete(billLines).where(eq(billLines.billId, id));
    await tx.insert(billLines).values(lines.map((l) => ({ ...l, billId: id })));
    // Only the change in quantity moves stock.
    const before = qtyByProduct(existing.lines);
    const after = qtyByProduct(lines);
    const diff = new Map<number, number>();
    for (const p of new Set([...before.keys(), ...after.keys()])) diff.set(p, (after.get(p) ?? 0) - (before.get(p) ?? 0));
    await moveStock(tx, diff, { kind: "purchase_edit", billId: id, date: header.date, note: header.billNo, userId });
    await removePrices(tx, id);
    if (header.updatePrices) await recordPrices(tx, id, { ...header, vendorName: vendor.name }, lines);
  });
}

export async function cancelBill(id: number, reason: string, userId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const existing = await lockBill(tx, id);
    await tx
      .update(bills)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
      .where(eq(bills.id, id));
    const out = new Map([...qtyByProduct(existing.lines)].map(([p, q]) => [p, -q]));
    await moveStock(tx, out, { kind: "purchase_cancel", billId: id, date: todayInIndia(), note: existing.billNo, userId });
    // The parts go back to the purchase price they had before this bill.
    await removePrices(tx, id);
  });
}

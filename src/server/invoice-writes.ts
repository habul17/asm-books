import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { withTransaction, type Tx } from "@/db";
import {
  creditNotes,
  customers,
  invoiceLines,
  invoices,
  priceLists,
  products,
  stockMovements,
} from "@/db/schema";
import { calcInvoice, financialYear, invoiceNumber, taxTypeFor } from "@/lib/invoices/math";
import type { InvoiceInput } from "@/lib/invoices/validation";
import { round2 } from "@/lib/pricing";
import { loadBusiness } from "@/server/settings";

import { purchasePriceAt } from "./product-search";

/** A problem with what the user entered; the message is safe to show. */
export class InvoiceInputError extends Error {}

/** Key for the lock that hands out invoice numbers one at a time. */
const INVOICE_NUMBER_LOCK = 72_810_001;

/** Today's date in India, YYYY-MM-DD. */
export const todayInIndia = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface ExistingInvoice {
  id: number;
  fy: string;
  customerId: number | null;
  priceListId: number | null;
  lines: { productId: number | null; cost: number | null; qty: number }[];
}

/** Checks the input against the database and works out every amount. */
async function prepare(tx: Tx, input: InvoiceInput, existing: ExistingInvoice | null) {
  const business = await loadBusiness(tx);
  const fy = financialYear(input.date);
  if (existing && fy !== existing.fy) {
    throw new InvoiceInputError(`This invoice belongs to the year ${existing.fy}. Keep the date inside that year.`);
  }

  // Customer: a saved customer, or a walk-in who pays on the spot.
  let customer: typeof customers.$inferSelect | null = null;
  if (input.customerId != null) {
    const [row] = await tx.select().from(customers).where(eq(customers.id, input.customerId));
    if (!row) throw new InvoiceInputError("Customer not found. Please choose again.");
    if (!row.active && row.id !== existing?.customerId) {
      throw new InvoiceInputError("This customer is switched off. Turn them on in Customers first.");
    }
    customer = row;
  }
  const paymentType = customer ? input.paymentType : "cash";
  const placeOfSupply = customer?.stateCode || business.stateCode || null;
  const taxType = taxTypeFor(business.stateCode || null, placeOfSupply);

  if (input.priceListId != null && input.priceListId !== existing?.priceListId) {
    const [list] = await tx
      .select({ id: priceLists.id })
      .from(priceLists)
      .where(and(eq(priceLists.id, input.priceListId), isNull(priceLists.deletedAt)));
    if (!list) throw new InvoiceInputError("Price list not found. Please choose again.");
  }

  const ids = [...new Set(input.lines.map((l) => l.productId).filter((id): id is number => id != null))];
  const found = ids.length
    ? await tx
        .select({
          id: products.id,
          partNo: products.partNo,
          hsn: products.hsn,
          unit: products.unit,
          purchase: purchasePriceAt(0),
        })
        .from(products)
        .where(inArray(products.id, ids))
    : [];
  const byId = new Map(found.map((p) => [p.id, p]));

  const lines = input.lines.map((l, i) => {
    const p = l.productId != null ? byId.get(l.productId) : undefined;
    if (l.productId != null && !p) throw new InvoiceInputError(`Item ${i + 1}: this part no longer exists.`);
    const qty = Math.round(l.qty * 1000) / 1000;
    if (qty <= 0) throw new InvoiceInputError(`Item ${i + 1}: quantity must be more than 0`);
    // When editing, keep the cost recorded at the time of sale.
    const old = existing?.lines.find((o) => o.productId != null && o.productId === l.productId);
    return {
      lineNo: i + 1,
      productId: l.productId,
      partNo: p?.partNo ?? null,
      description: l.description,
      hsn: p?.hsn ?? null,
      unit: p?.unit ?? "Nos",
      qty,
      rate: round2(l.rate),
      discountPct: l.discountPct,
      gstRate: l.gstRate,
      cost: old ? old.cost : (p?.purchase ?? null),
    };
  });

  const { lines: calculated, totals } = calcInvoice(lines, taxType);
  const terms = customer?.paymentTermsDays;
  const header = {
    date: input.date,
    dueDate: paymentType === "credit" && terms != null ? addDays(input.date, terms) : null,
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? (input.walkInName || "Cash Sale"),
    customerGstin: customer?.gstin ?? null,
    customerMobile: customer ? customer.mobile : input.walkInMobile || null,
    billingAddress: customer
      ? [customer.address, [customer.city, customer.pincode].filter(Boolean).join(" - ")].filter(Boolean).join("\n") ||
        null
      : null,
    placeOfSupply,
    taxType,
    priceListId: input.priceListId,
    paymentType,
    notes: input.notes || null,
    ...totals,
  };
  return { fy, prefix: business.invoicePrefix, header, lines: calculated };
}

export const qtyByProduct = (lines: { productId: number | null; qty: number }[]) => {
  const m = new Map<number, number>();
  for (const l of lines) if (l.productId != null) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
  return m;
};

/** Records stock changes and updates each product's running stock in two statements. */
export async function moveStock(
  tx: Tx,
  changes: Map<number, number>,
  info: {
    kind: (typeof stockMovements.$inferInsert)["kind"];
    invoiceId: number;
    creditNoteId?: number;
    date: string;
    note: string;
    userId: number;
  },
) {
  const rows = [...changes].map(([productId, qty]) => ({ productId, qty: Math.round(qty * 1000) / 1000 })).filter((r) => r.qty !== 0);
  if (!rows.length) return;
  await tx.insert(stockMovements).values(
    rows.map((r) => ({
      productId: r.productId,
      qty: r.qty,
      kind: info.kind,
      invoiceId: info.invoiceId,
      creditNoteId: info.creditNoteId ?? null,
      date: info.date,
      note: info.note,
      createdBy: info.userId,
    })),
  );
  const values = sql.join(
    rows.map((r) => sql`(${r.productId}::integer, ${r.qty}::numeric)`),
    sql`, `,
  );
  await tx.execute(sql`
    UPDATE ${products} SET stock_qty = ${products.stockQty} + v.delta, updated_at = now()
    FROM (VALUES ${values}) AS v(id, delta)
    WHERE ${products.id} = v.id`);
}

export async function createInvoice(input: InvoiceInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    const { fy, prefix, header, lines } = await prepare(tx, input, null);
    // One invoice number at a time, so two people saving together never get the same number.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${INVOICE_NUMBER_LOCK})`);
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${invoices.seq}), 0) + 1`.mapWith(Number) })
      .from(invoices)
      .where(eq(invoices.fy, fy));
    const number = invoiceNumber(prefix, fy, next);
    const [{ id }] = await tx
      .insert(invoices)
      .values({ ...header, number, fy, seq: next, createdBy: userId })
      .returning({ id: invoices.id });
    await tx.insert(invoiceLines).values(lines.map((l) => ({ ...l, invoiceId: id })));
    const sold = new Map([...qtyByProduct(lines)].map(([p, q]) => [p, -q]));
    await moveStock(tx, sold, { kind: "sale", invoiceId: id, date: header.date, note: number, userId });
    return id;
  });
}

async function lockInvoice(tx: Tx, id: number) {
  const [inv] = await tx
    .select({
      id: invoices.id,
      number: invoices.number,
      fy: invoices.fy,
      status: invoices.status,
      customerId: invoices.customerId,
      priceListId: invoices.priceListId,
    })
    .from(invoices)
    .where(eq(invoices.id, id))
    .for("update");
  if (!inv) throw new InvoiceInputError("Invoice not found.");
  if (inv.status === "cancelled") throw new InvoiceInputError("This invoice is cancelled and cannot be changed.");
  // Returns are worked out from the invoice's lines, so those lines must stay as they are.
  const [returned] = await tx
    .select({ number: creditNotes.number })
    .from(creditNotes)
    .where(and(eq(creditNotes.invoiceId, id), eq(creditNotes.status, "final")))
    .limit(1);
  if (returned) {
    throw new InvoiceInputError(
      `Goods from this invoice were returned on credit note ${returned.number}. Cancel that credit note first.`,
    );
  }
  const lines = await tx
    .select({ productId: invoiceLines.productId, cost: invoiceLines.cost, qty: invoiceLines.qty })
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, id));
  return { ...inv, lines };
}

export async function updateInvoice(id: number, input: InvoiceInput, userId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const existing = await lockInvoice(tx, id);
    const { header, lines } = await prepare(tx, input, existing);
    await tx.update(invoices).set(header).where(eq(invoices.id, id));
    await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
    await tx.insert(invoiceLines).values(lines.map((l) => ({ ...l, invoiceId: id })));
    // Only the change in quantity moves stock.
    const before = qtyByProduct(existing.lines);
    const after = qtyByProduct(lines);
    const diff = new Map<number, number>();
    for (const p of new Set([...before.keys(), ...after.keys()])) diff.set(p, (before.get(p) ?? 0) - (after.get(p) ?? 0));
    await moveStock(tx, diff, { kind: "sale_edit", invoiceId: id, date: header.date, note: existing.number, userId });
  });
}

export async function cancelInvoice(id: number, reason: string, userId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const existing = await lockInvoice(tx, id);
    await tx
      .update(invoices)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason || null })
      .where(eq(invoices.id, id));
    await moveStock(tx, qtyByProduct(existing.lines), {
      kind: "sale_cancel",
      invoiceId: id,
      date: todayInIndia(),
      note: existing.number,
      userId,
    });
  });
}

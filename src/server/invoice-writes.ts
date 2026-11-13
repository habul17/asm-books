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
  salesDocs,
  stockMovements,
} from "@/db/schema";
import { parseExtra, type ExtraValues } from "@/lib/custom-fields";
import { calcInvoice, financialYear, invoiceNumber, taxTypeFor } from "@/lib/invoices/math";
import type { InvoiceInput } from "@/lib/invoices/validation";
import { round2 } from "@/lib/pricing";
import { loadCustomFields } from "@/server/custom-fields";
import { recordRecurringInvoice } from "@/server/recurring";
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
  extra: ExtraValues;
  lines: { productId: number | null; cost: number | null; qty: number }[];
}

type Customer = typeof customers.$inferSelect;
type Business = Awaited<ReturnType<typeof loadBusiness>>;

/**
 * The saved customer of a sale; null for a walk-in. A switched-off customer
 * is only accepted on a document that already has them (`keepId`).
 */
export async function loadSaleCustomer(tx: Tx, customerId: number | null, keepId?: number | null): Promise<Customer | null> {
  if (customerId == null) return null;
  const [row] = await tx.select().from(customers).where(eq(customers.id, customerId));
  if (!row) throw new InvoiceInputError("Customer not found. Please choose again.");
  if (!row.active && row.id !== keepId) {
    throw new InvoiceInputError("This customer is switched off. Turn them on in Customers first.");
  }
  return row;
}

/** Where the sale is supplied and which GST follows. The state picked on the document wins; otherwise the customer's state, then our own. */
export function saleSupply(business: Business, customer: Customer | null, chosen: string | null) {
  if (chosen && !business.stateCode) {
    throw new InvoiceInputError("Set your own state in Settings before billing another state.");
  }
  const placeOfSupply = chosen ?? (customer?.stateCode || business.stateCode || null);
  return { placeOfSupply, taxType: taxTypeFor(business.stateCode || null, placeOfSupply) };
}

/** The buyer's details as copied onto the document, so later changes to the customer do not alter it. */
export function saleParty(customer: Customer | null, walkIn: { name: string; mobile: string; fallbackName: string }) {
  return {
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? (walkIn.name || walkIn.fallbackName),
    customerGstin: customer?.gstin ?? null,
    customerMobile: customer ? customer.mobile : walkIn.mobile || null,
    billingAddress: customer
      ? [customer.address, [customer.city, customer.pincode].filter(Boolean).join(" - ")].filter(Boolean).join("\n") ||
        null
      : null,
  };
}

/** Checks that a newly chosen price list still exists. */
export async function assertPriceList(tx: Tx, priceListId: number | null, currentId?: number | null) {
  if (priceListId == null || priceListId === currentId) return;
  const [list] = await tx
    .select({ id: priceLists.id })
    .from(priceLists)
    .where(and(eq(priceLists.id, priceListId), isNull(priceLists.deletedAt)));
  if (!list) throw new InvoiceInputError("Price list not found. Please choose again.");
}

/** The parts on a document's lines, by id, with what the document copies from them. */
export async function loadSaleProducts(tx: Tx, lines: { productId: number | null }[]) {
  const ids = [...new Set(lines.map((l) => l.productId).filter((id): id is number => id != null))];
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
  return new Map(found.map((p) => [p.id, p]));
}

/** Checks the input against the database and works out every amount. */
async function prepare(tx: Tx, input: InvoiceInput, existing: ExistingInvoice | null) {
  const business = await loadBusiness(tx);
  const fy = financialYear(input.date);
  if (existing && fy !== existing.fy) {
    throw new InvoiceInputError(`This invoice belongs to the year ${existing.fy}. Keep the date inside that year.`);
  }

  // Customer: a saved customer, or a walk-in who pays on the spot.
  const customer = await loadSaleCustomer(tx, input.customerId, existing?.customerId);
  // Walk-ins can be switched off in Settings; an existing walk-in invoice can still be edited.
  const wasWalkIn = existing != null && existing.customerId == null;
  if (!customer && !business.allowWalkIn && !wasWalkIn) {
    throw new InvoiceInputError("Choose a customer. Walk-in sales are switched off in Settings.");
  }
  const paymentType = customer ? input.paymentType : "cash";
  const { placeOfSupply, taxType } = saleSupply(business, customer, input.placeOfSupply);
  await assertPriceList(tx, input.priceListId, existing?.priceListId);
  const byId = await loadSaleProducts(tx, input.lines);

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

  // Custom fields: only fields that exist are saved; switched-off ones keep what they had.
  const extra = parseExtra(await loadCustomFields("invoice", tx), (fieldId) => input.extra[String(fieldId)], existing?.extra);
  if (extra.error !== undefined) throw new InvoiceInputError(extra.error);

  const { lines: calculated, totals } = calcInvoice(lines, taxType);
  const terms = customer?.paymentTermsDays;
  const header = {
    date: input.date,
    dueDate: paymentType === "credit" && terms != null ? addDays(input.date, terms) : null,
    ...saleParty(customer, { name: input.walkInName, mobile: input.walkInMobile, fallbackName: "Cash Sale" }),
    placeOfSupply,
    taxType,
    priceListId: input.priceListId,
    paymentType,
    cashMode: paymentType === "cash" ? input.cashMode : null,
    notes: input.notes || null,
    extra: extra.value,
    ...totals,
  };
  return {
    fy,
    prefix: business.invoicePrefix,
    allowShortStock: business.allowShortStock,
    header,
    lines: calculated,
  };
}

export const qtyByProduct = (lines: { productId: number | null; qty: number }[]) => {
  const m = new Map<number, number>();
  for (const l of lines) if (l.productId != null) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty);
  return m;
};

/**
 * Stops a sale that would take a part below zero. Locks the parts being sold
 * so two invoices saved together cannot both take the last piece.
 * `changes` holds stock deltas; only negative ones (stock going out) are checked.
 */
export async function assertStockAvailable(tx: Tx, changes: Map<number, number>) {
  const out = [...changes].filter(([, qty]) => qty < 0);
  if (!out.length) return;
  const rows = await tx
    .select({ id: products.id, partNo: products.partNo, stockQty: products.stockQty, unit: products.unit })
    .from(products)
    .where(inArray(products.id, out.map(([id]) => id)))
    .orderBy(products.id)
    .for("update");
  const byId = new Map(rows.map((r) => [r.id, r]));
  const short = out
    .map(([id, qty]) => ({ p: byId.get(id), need: -qty }))
    .filter(({ p, need }) => p && Math.round((p.stockQty - need) * 1000) < 0);
  if (!short.length) return;
  const list = short
    .slice(0, 5)
    .map(({ p }) => `${p!.partNo} (only ${Math.max(p!.stockQty, 0)} ${p!.unit} in stock)`)
    .join(", ");
  throw new InvoiceInputError(
    `Not enough stock: ${list}${short.length > 5 ? ` and ${short.length - 5} more` : ""}. ` +
      "Enter the stock first, or ask the owner to allow selling more than stock in Settings.",
  );
}

/** Records stock changes and updates each product's running stock in two statements. */
export async function moveStock(
  tx: Tx,
  changes: Map<number, number>,
  info: {
    kind: (typeof stockMovements.$inferInsert)["kind"];
    invoiceId?: number;
    creditNoteId?: number;
    billId?: number;
    adjustmentId?: number;
    purchaseReturnId?: number;
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
      invoiceId: info.invoiceId ?? null,
      creditNoteId: info.creditNoteId ?? null,
      billId: info.billId ?? null,
      adjustmentId: info.adjustmentId ?? null,
      purchaseReturnId: info.purchaseReturnId ?? null,
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

/**
 * Marks the quote, order or challan an invoice was made from as done. An order
 * whose challan is invoiced is done too. A document that is already closed or
 * cancelled is left alone.
 */
async function closeInvoicedDoc(tx: Tx, docId: number, invoiceId: number) {
  const [doc] = await tx
    .update(salesDocs)
    .set({ status: "closed", invoiceId })
    .where(and(eq(salesDocs.id, docId), eq(salesDocs.status, "open")))
    .returning({ kind: salesDocs.kind, sourceId: salesDocs.sourceId });
  if (doc?.kind === "challan" && doc.sourceId != null) {
    await tx
      .update(salesDocs)
      .set({ status: "closed", invoiceId })
      .where(and(eq(salesDocs.id, doc.sourceId), eq(salesDocs.kind, "order"), eq(salesDocs.status, "open")));
  }
}

export async function createInvoice(input: InvoiceInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    const { fy, prefix, allowShortStock, header, lines } = await prepare(tx, input, null);
    const sold = new Map([...qtyByProduct(lines)].map(([p, q]) => [p, -q]));
    if (!allowShortStock) await assertStockAvailable(tx, sold);
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
    await moveStock(tx, sold, { kind: "sale", invoiceId: id, date: header.date, note: number, userId });
    if (input.fromDocId != null) await closeInvoicedDoc(tx, input.fromDocId, id);
    if (input.repeatId != null) await recordRecurringInvoice(tx, input.repeatId, id);
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
      extra: invoices.extra,
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
    const { allowShortStock, header, lines } = await prepare(tx, input, existing);
    // Only the change in quantity moves stock.
    const before = qtyByProduct(existing.lines);
    const after = qtyByProduct(lines);
    const diff = new Map<number, number>();
    for (const p of new Set([...before.keys(), ...after.keys()])) diff.set(p, (before.get(p) ?? 0) - (after.get(p) ?? 0));
    if (!allowShortStock) await assertStockAvailable(tx, diff);
    await tx.update(invoices).set(header).where(eq(invoices.id, id));
    await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
    await tx.insert(invoiceLines).values(lines.map((l) => ({ ...l, invoiceId: id })));
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

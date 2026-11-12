import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { withTransaction, type Tx } from "@/db";
import { invoices, salesDocLines, salesDocs } from "@/db/schema";
import { calcInvoice, financialYear, invoiceNumber } from "@/lib/invoices/math";
import { round2 } from "@/lib/pricing";
import { closesSource, SALES_DOC_KIND, type SalesDocKind } from "@/lib/sales-docs/kinds";
import type { SalesDocInput } from "@/lib/sales-docs/validation";
import type { Transport } from "@/lib/transport";
import { loadBusiness } from "@/server/settings";

import {
  assertPriceList,
  InvoiceInputError,
  loadSaleCustomer,
  loadSaleProducts,
  saleParty,
  saleSupply,
} from "./invoice-writes";

/** Key for the lock that hands out quote, order and challan numbers one at a time. */
const SALES_DOC_NUMBER_LOCK = 72_810_009;

interface ExistingDoc {
  fy: string;
  customerId: number | null;
  priceListId: number | null;
}

/** Checks the input against the database and works out every amount. */
async function prepare(tx: Tx, kind: SalesDocKind, input: SalesDocInput, existing: ExistingDoc | null) {
  const info = SALES_DOC_KIND[kind];
  const business = await loadBusiness(tx);
  const fy = financialYear(input.date);
  if (existing && fy !== existing.fy) {
    throw new InvoiceInputError(`This ${info.noun} belongs to the year ${existing.fy}. Keep the date inside that year.`);
  }
  const customer = await loadSaleCustomer(tx, input.customerId, existing?.customerId);
  if (!customer && !input.walkInName) {
    throw new InvoiceInputError("Choose a customer, or type the customer's name.");
  }
  const { placeOfSupply, taxType } = saleSupply(business, customer, input.placeOfSupply);
  await assertPriceList(tx, input.priceListId, existing?.priceListId);
  const byId = await loadSaleProducts(tx, input.lines);

  const lines = input.lines.map((l, i) => {
    const p = l.productId != null ? byId.get(l.productId) : undefined;
    if (l.productId != null && !p) throw new InvoiceInputError(`Item ${i + 1}: this part no longer exists.`);
    const qty = Math.round(l.qty * 1000) / 1000;
    if (qty <= 0) throw new InvoiceInputError(`Item ${i + 1}: quantity must be more than 0`);
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
    };
  });

  const { lines: calculated, totals } = calcInvoice(lines, taxType);
  const header = {
    date: input.date,
    secondDate: info.secondDateLabel ? input.secondDate : null,
    ...saleParty(customer, { name: input.walkInName, mobile: input.walkInMobile, fallbackName: "Customer" }),
    placeOfSupply,
    taxType,
    priceListId: input.priceListId,
    notes: input.notes || null,
    reason: kind === "challan" ? input.reason || null : null,
    ...totals,
  };
  return { fy, prefix: business[info.prefixKey], header, lines: calculated };
}

/**
 * The open quote or order a new document is made from. Returns null when the
 * source cannot lead to this kind, so a stray id is simply ignored.
 */
async function lockSource(tx: Tx, kind: SalesDocKind, sourceId: number | null) {
  if (sourceId == null) return null;
  const [source] = await tx
    .select({ id: salesDocs.id, kind: salesDocs.kind, status: salesDocs.status })
    .from(salesDocs)
    .where(eq(salesDocs.id, sourceId))
    .for("update");
  const leadsHere =
    (source?.kind === "quote" && kind === "order") || (source?.kind === "order" && kind === "challan");
  return source && leadsHere && source.status !== "cancelled" ? source : null;
}

export async function createSalesDoc(kind: SalesDocKind, input: SalesDocInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    const { fy, prefix, header, lines } = await prepare(tx, kind, input, null);
    const source = await lockSource(tx, kind, input.sourceId);
    // One number at a time, so two people saving together never get the same number.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SALES_DOC_NUMBER_LOCK})`);
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${salesDocs.seq}), 0) + 1`.mapWith(Number) })
      .from(salesDocs)
      .where(and(eq(salesDocs.kind, kind), eq(salesDocs.fy, fy)));
    const number = invoiceNumber(prefix, fy, next);
    const [{ id }] = await tx
      .insert(salesDocs)
      .values({ ...header, kind, number, fy, seq: next, sourceId: source?.id ?? null, createdBy: userId })
      .returning({ id: salesDocs.id });
    await tx.insert(salesDocLines).values(lines.map((l) => ({ ...l, docId: id })));
    if (source && source.status === "open" && closesSource(source.kind, kind)) {
      await tx.update(salesDocs).set({ status: "closed" }).where(eq(salesDocs.id, source.id));
    }
    return id;
  });
}

async function lockDoc(tx: Tx, kind: SalesDocKind, id: number) {
  const [doc] = await tx
    .select({
      id: salesDocs.id,
      fy: salesDocs.fy,
      status: salesDocs.status,
      customerId: salesDocs.customerId,
      priceListId: salesDocs.priceListId,
      invoiceId: salesDocs.invoiceId,
    })
    .from(salesDocs)
    .where(and(eq(salesDocs.id, id), eq(salesDocs.kind, kind)))
    .for("update");
  if (!doc) throw new InvoiceInputError(`This ${SALES_DOC_KIND[kind].noun} was not found.`);
  return doc;
}

export async function updateSalesDoc(kind: SalesDocKind, id: number, input: SalesDocInput): Promise<void> {
  await withTransaction(async (tx) => {
    const existing = await lockDoc(tx, kind, id);
    if (existing.status !== "open") {
      throw new InvoiceInputError(`This ${SALES_DOC_KIND[kind].noun} is ${existing.status} and cannot be changed.`);
    }
    const { header, lines } = await prepare(tx, kind, input, existing);
    await tx.update(salesDocs).set(header).where(eq(salesDocs.id, id));
    await tx.delete(salesDocLines).where(eq(salesDocLines.docId, id));
    await tx.insert(salesDocLines).values(lines.map((l) => ({ ...l, docId: id })));
  });
}

/**
 * Closes, reopens or cancels a document. Only an open one can be closed or
 * cancelled; only a closed one that has not become an invoice can be reopened.
 */
export async function setSalesDocStatus(kind: SalesDocKind, id: number, to: "open" | "closed" | "cancelled") {
  await withTransaction(async (tx) => {
    const doc = await lockDoc(tx, kind, id);
    const noun = SALES_DOC_KIND[kind].noun;
    if (to === "open") {
      if (doc.status !== "closed") throw new InvoiceInputError(`Only a closed ${noun} can be reopened.`);
      if (doc.invoiceId != null) {
        const [inv] = await tx
          .select({ number: invoices.number, status: invoices.status })
          .from(invoices)
          .where(eq(invoices.id, doc.invoiceId));
        if (inv?.status === "final") {
          throw new InvoiceInputError(`This ${noun} became invoice ${inv.number}. Cancel that invoice first.`);
        }
      }
      await tx.update(salesDocs).set({ status: "open", invoiceId: null }).where(eq(salesDocs.id, id));
      return;
    }
    if (doc.status !== "open") throw new InvoiceInputError(`This ${noun} is already ${doc.status}.`);
    await tx.update(salesDocs).set({ status: to }).where(eq(salesDocs.id, id));
  });
}

/** Saves transporter and e-way bill details on a delivery challan. */
export async function setSalesDocTransport(id: number, transport: Transport): Promise<void> {
  await withTransaction(async (tx) => {
    const doc = await lockDoc(tx, "challan", id);
    if (doc.status === "cancelled") throw new InvoiceInputError("This delivery challan is cancelled and cannot be changed.");
    await tx.update(salesDocs).set({ transport }).where(eq(salesDocs.id, id));
  });
}

/** Saves transporter and e-way bill details on an invoice. They do not change any amount. */
export async function setInvoiceTransport(id: number, transport: Transport): Promise<void> {
  await withTransaction(async (tx) => {
    const [inv] = await tx.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, id)).for("update");
    if (!inv) throw new InvoiceInputError("Invoice not found.");
    if (inv.status === "cancelled") throw new InvoiceInputError("This invoice is cancelled and cannot be changed.");
    await tx.update(invoices).set({ transport }).where(eq(invoices.id, id));
  });
}

import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { withTransaction, type Tx } from "@/db";
import { col } from "@/db/sql";
import { creditNoteLines, creditNotes, invoiceLines, invoices } from "@/db/schema";
import type { CreditNoteInput } from "@/lib/credit-notes/validation";
import { formatQty } from "@/lib/format";
import { calcInvoice, financialYear, invoiceNumber } from "@/lib/invoices/math";
import { loadBusiness } from "@/server/settings";

import { moveStock, qtyByProduct, todayInIndia } from "./invoice-writes";

/** A problem with what the user entered; the message is safe to show. */
export class CreditNoteInputError extends Error {}

/** Key for the lock that hands out credit note numbers one at a time. */
const CREDIT_NOTE_NUMBER_LOCK = 72_810_003;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** How much of each invoice line has already come back on active credit notes. */
export const returnedQty = sql<number>`coalesce((
  SELECT sum(cnl.qty) FROM ${creditNoteLines} cnl
  JOIN ${creditNotes} cn ON cn.id = cnl.credit_note_id
  WHERE cnl.invoice_line_id = ${col(invoiceLines.id)} AND cn.status = 'final'
), 0)`.mapWith(Number);

export async function createCreditNote(input: CreditNoteInput, userId: number): Promise<number> {
  return withTransaction(async (tx) => {
    // Locking the invoice makes two returns of the same goods wait for each other.
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, input.invoiceId)).for("update");
    if (!inv) throw new CreditNoteInputError("Invoice not found.");
    if (inv.status === "cancelled") throw new CreditNoteInputError("This invoice is cancelled; nothing can be returned.");
    if (input.date < inv.date) throw new CreditNoteInputError("The return cannot be dated before the invoice.");

    const sold = await tx
      .select({ line: invoiceLines, returned: returnedQty })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, inv.id));
    const byId = new Map(sold.map((s) => [s.line.id, s]));

    const lines = input.lines.map((l, i) => {
      const s = byId.get(l.invoiceLineId);
      if (!s) throw new CreditNoteInputError(`Item ${i + 1} is not on this invoice. Please reload the page.`);
      const qty = round3(l.qty);
      const left = round3(s.line.qty - s.returned);
      if (qty > left) {
        throw new CreditNoteInputError(
          left > 0
            ? `${s.line.description}: only ${formatQty(left)} can still be returned.`
            : `${s.line.description}: already fully returned.`,
        );
      }
      const { partNo, description, hsn, unit, rate, discountPct, gstRate, cost, productId } = s.line;
      // Same rate, discount and GST as billed, so the credit mirrors the invoice exactly.
      return {
        invoiceLineId: s.line.id,
        lineNo: i + 1,
        productId,
        partNo,
        description,
        hsn,
        unit,
        qty,
        rate,
        discountPct,
        gstRate,
        cost,
      };
    });

    const { lines: calculated, totals } = calcInvoice(lines, inv.taxType);
    const fy = financialYear(input.date);
    const { creditNotePrefix } = await loadBusiness(tx);

    // One number at a time, so two people saving together never get the same number.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${CREDIT_NOTE_NUMBER_LOCK})`);
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${creditNotes.seq}), 0) + 1`.mapWith(Number) })
      .from(creditNotes)
      .where(eq(creditNotes.fy, fy));
    const number = invoiceNumber(creditNotePrefix, fy, next);

    const [{ id }] = await tx
      .insert(creditNotes)
      .values({
        number,
        fy,
        seq: next,
        date: input.date,
        invoiceId: inv.id,
        customerId: inv.customerId,
        customerName: inv.customerName,
        customerGstin: inv.customerGstin,
        customerMobile: inv.customerMobile,
        billingAddress: inv.billingAddress,
        placeOfSupply: inv.placeOfSupply,
        taxType: inv.taxType,
        // A walk-in customer has no account to credit, so they are paid back.
        refundType: inv.customerId == null ? "cash" : input.refundType,
        restocked: input.restock,
        reason: input.reason,
        notes: input.notes || null,
        ...totals,
        createdBy: userId,
      })
      .returning({ id: creditNotes.id });
    await tx.insert(creditNoteLines).values(calculated.map((l) => ({ ...l, creditNoteId: id })));

    if (input.restock) {
      await moveStock(tx, qtyByProduct(calculated), {
        kind: "sale_return",
        invoiceId: inv.id,
        creditNoteId: id,
        date: input.date,
        note: number,
        userId,
      });
    }
    return id;
  });
}

async function lockCreditNote(tx: Tx, id: number) {
  const [row] = await tx
    .select({
      id: creditNotes.id,
      number: creditNotes.number,
      invoiceId: creditNotes.invoiceId,
      status: creditNotes.status,
      restocked: creditNotes.restocked,
    })
    .from(creditNotes)
    .where(eq(creditNotes.id, id))
    .for("update");
  if (!row) throw new CreditNoteInputError("Credit note not found.");
  if (row.status === "cancelled") throw new CreditNoteInputError("This credit note is already cancelled.");
  return row;
}

export async function cancelCreditNote(id: number, reason: string, userId: number): Promise<void> {
  await withTransaction(async (tx) => {
    const cn = await lockCreditNote(tx, id);
    await tx
      .update(creditNotes)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
      .where(and(eq(creditNotes.id, id), eq(creditNotes.status, "final")));
    if (cn.restocked) {
      const lines = await tx
        .select({ productId: creditNoteLines.productId, qty: creditNoteLines.qty })
        .from(creditNoteLines)
        .where(eq(creditNoteLines.creditNoteId, id));
      const back = new Map([...qtyByProduct(lines)].map(([p, q]) => [p, -q]));
      await moveStock(tx, back, {
        kind: "sale_return_cancel",
        invoiceId: cn.invoiceId,
        creditNoteId: id,
        date: todayInIndia(),
        note: cn.number,
        userId,
      });
    }
  });
}

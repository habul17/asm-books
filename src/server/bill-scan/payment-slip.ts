import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { customers, payments, vendorPayments, vendors } from "@/db/schema";
import { reviewSlip, scannedSlipSchema, SLIP_INSTRUCTIONS, SLIP_JSON_SCHEMA, type SlipDraft } from "@/lib/payments/scan";
import { pickCustomerById, type PickedCustomer } from "@/server/invoices";
import { todayInIndia } from "@/server/invoice-writes";
import { pickVendorById, type PickedVendor } from "@/server/vendors";

import { readDocument } from "./index";
import { BillScanError, type BillFile } from "./reader";

const SLIP_TASK = {
  noun: "payment slip",
  ask: "Read this proof of payment and return its details.",
  instructions: SLIP_INSTRUCTIONS,
  schema: SLIP_JSON_SCHEMA,
};

async function readSlip(file: BillFile, direction: "in" | "out"): Promise<SlipDraft> {
  const parsed = scannedSlipSchema.safeParse(await readDocument(file, SLIP_TASK));
  if (!parsed.success) throw new BillScanError("The payment slip could not be read. Try a clearer screenshot.");
  const table = direction === "in" ? customers : vendors;
  const parties = await getDb()
    .select({ id: table.id, name: table.name, mobile: table.mobile })
    .from(table)
    .where(eq(table.active, true));
  return reviewSlip(parsed.data, { today: todayInIndia(), direction, parties });
}

/** Warns when a payment with the same reference is already saved, so it is not entered twice. */
async function alreadySaved(direction: "in" | "out", reference: string | null): Promise<string | null> {
  if (!reference || reference.length < 6) return null;
  const t = direction === "in" ? payments : vendorPayments;
  const [row] = await getDb()
    .select({ id: t.id })
    .from(t)
    .where(and(eq(t.status, "final"), eq(sql`lower(${t.reference})`, reference.toLowerCase())))
    .limit(1);
  return row ? `A payment with reference ${reference} is already saved. Do not save it again.` : null;
}

export interface ReceivedSlipResult extends SlipDraft {
  customer: PickedCustomer | null;
}
export interface PaidSlipResult extends SlipDraft {
  vendor: PickedVendor | null;
}

/** Reads proof of money received and prepares the payment form. Nothing is saved. The caller must have checked the user. */
export async function scanReceivedSlip(file: BillFile): Promise<ReceivedSlipResult> {
  const draft = await readSlip(file, "in");
  const [customer, dup] = await Promise.all([draft.partyId ? pickCustomerById(draft.partyId) : null, alreadySaved("in", draft.reference)]);
  if (dup) draft.warnings.unshift(dup);
  return { ...draft, customer };
}

/** Reads proof of money paid to a vendor and prepares the payment form. Nothing is saved. The caller must have checked the user. */
export async function scanPaidSlip(file: BillFile): Promise<PaidSlipResult> {
  const draft = await readSlip(file, "out");
  const [vendor, dup] = await Promise.all([draft.partyId ? pickVendorById(draft.partyId) : null, alreadySaved("out", draft.reference)]);
  if (dup) draft.warnings.unshift(dup);
  return { ...draft, vendor };
}

"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { vendors } from "@/db/schema";
import { parseBillInput } from "@/lib/bills/validation";
import { parseProduct } from "@/lib/catalogue/product-validation";
import { parseVendor } from "@/lib/vendors/validation";
import { isOwner, requireUser } from "@/server/auth";
import { claimScan, scanIdOf } from "@/server/document-writes";
import { scanBill, type BillScanResult } from "@/server/bill-scan";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import { BillInputError, cancelBill, createBill, updateBill, deleteBill } from "@/server/bill-writes";
import { pickBillItems } from "@/server/bills";
import { createProduct, ProductInputError } from "@/server/product-writes";
import { pickVendorById, pickVendors, type PickedVendor } from "@/server/vendors";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof BillInputError) return { error: err.message };
  console.error(`[bills] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Records a bill (id null) or updates one, then opens it. */
export async function saveBill(id: number | null, input: unknown): Promise<ActionState> {
  const user = await requireUser();
  if (id != null && !idSchema.safeParse(id).success) return { error: "Bill not found." };
  const parsed = parseBillInput(input);
  if (parsed.error !== undefined) return { error: parsed.error };

  let savedId: number;
  try {
    if (id == null) savedId = await createBill(parsed.value, user.id);
    else {
      await updateBill(id, parsed.value, user.id);
      savedId = id;
    }
  } catch (err) {
    return failure("save", err);
  }
  // A scanned paper used to fill the form is attached to what was saved.
  await claimScan(scanIdOf(input), { billId: savedId }, user);
  redirect(`/bills/${savedId}`);
}

export async function cancelBillAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can cancel. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Bill not found." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Please give a reason for cancelling." };
  if (reason.length > 500) return { error: "Reason can be at most 500 characters." };
  try {
    await cancelBill(id, reason, user.id);
  } catch (err) {
    return failure("cancel", err);
  }
  refresh();
  return { ok: true };
}

/**
 * Reads an uploaded photo or PDF of a vendor's bill and returns a draft to review.
 * Nothing is saved, and the file is not kept.
 */
export async function scanBillAction(formData: FormData): Promise<ScanAnswer<BillScanResult>> {
  const user = await requireUser();
  return scanUpload(formData, "bill", (file) => scanBill(file), { user, folder: "bills", title: "Bill scan" });
}

// Adding what a scanned bill names but the app does not know yet, without leaving the bill.

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Adds the supplier printed on a scanned bill as a vendor (or finds them if already saved). */
export async function addScannedVendor(
  input: unknown,
): Promise<{ vendor: PickedVendor; error?: never } | { error: string; vendor?: never }> {
  await requireUser();
  const raw = (typeof input === "object" && input) || {};
  // Same as the vendor form with only the name and GSTIN typed in; a valid GSTIN fills in the state.
  const empty = Object.fromEntries(
    ["contactPerson", "mobile", "email", "address", "city", "stateCode", "pincode", "openingBalance", "paymentTermsDays", "notes"].map(
      (k) => [k, ""],
    ),
  );
  const parsed = parseVendor({
    ...empty,
    name: str((raw as { name?: unknown }).name),
    gstin: str((raw as { gstin?: unknown }).gstin),
    active: "on",
  });
  if (!parsed.value) return { error: parsed.error };
  try {
    const db = getDb();
    const sameName = sql`lower(${vendors.name}) = lower(${parsed.value.name})`;
    const [existing] = await db
      .select({ id: vendors.id, active: vendors.active })
      .from(vendors)
      .where(parsed.value.gstin ? eq(vendors.gstin, parsed.value.gstin) : sameName)
      .limit(1);
    if (existing && !existing.active) return { error: "This vendor is switched off. Turn them on in Vendors first." };
    const id = existing?.id ?? (await db.insert(vendors).values(parsed.value).returning({ id: vendors.id }))[0].id;
    const vendor = await pickVendorById(id);
    if (!vendor) return { error: "Could not add the vendor. Please try again." };
    return { vendor };
  } catch (err) {
    console.error("[bills] add scanned vendor failed:", err instanceof Error ? err.message : err);
    return { error: "Could not add the vendor. Please try again." };
  }
}

/** Adds a part read from a scanned bill to the parts list, so the bill row can use it. */
export async function addScannedPart(input: unknown): Promise<
  | { item: { id: number; partNo: string; description: string; unit: string; gstRate: number }; error?: never }
  | { error: string; item?: never }
> {
  await requireUser();
  const raw = ((typeof input === "object" && input) || {}) as Record<string, unknown>;
  const gstRate = typeof raw.gstRate === "number" ? String(raw.gstRate) : "";
  const parsed = parseProduct({
    partNo: str(raw.partNo),
    description: str(raw.description),
    hsn: str(raw.hsn),
    unit: str(raw.unit),
    gstRate,
    active: "on",
  });
  if (!parsed.value) return { error: parsed.error };
  try {
    const id = await createProduct(parsed.value);
    const { partNo, description, unit } = parsed.value;
    return { item: { id, partNo, description, unit, gstRate: Number(gstRate) } };
  } catch (err) {
    if (err instanceof ProductInputError) return { error: err.message };
    console.error("[bills] add scanned part failed:", err instanceof Error ? err.message : err);
    return { error: "Could not add the part. Please try again." };
  }
}

// Lookups for the bill editor. They only read data.

export async function findVendors(query: unknown) {
  return pickVendors(typeof query === "string" ? query : "");
}

export async function findBillItems(query: unknown) {
  return pickBillItems(typeof query === "string" ? query : "");
}

/** Deletes it for good, then goes back to the list. Owner only. */
export async function deleteBillAction(id: number): Promise<ActionState & { href?: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Not found." };
  if (!isOwner(user)) return { error: "Only the owner can delete. Please ask the owner." };
  try {
    await deleteBill(id);
  } catch (err) {
    return failure("delete", err);
  }
  return { href: "/bills" };
}

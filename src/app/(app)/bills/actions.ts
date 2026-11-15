"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { vendors } from "@/db/schema";
import { isScanMimeType, SCAN_MAX_BYTES } from "@/lib/bills/scan";
import { parseBillInput } from "@/lib/bills/validation";
import { parseProduct } from "@/lib/catalogue/product-validation";
import { parseVendor } from "@/lib/vendors/validation";
import { isOwner, requireUser } from "@/server/auth";
import { BillScanError, scanBill, type BillScanResult } from "@/server/bill-scan";
import { BillInputError, cancelBill, createBill, updateBill } from "@/server/bill-writes";
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
export async function scanBillAction(formData: FormData): Promise<{ scan: BillScanResult; error?: never } | { error: string; scan?: never }> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo or PDF of the bill." };
  if (!isScanMimeType(file.type)) return { error: "Use a photo (JPG or PNG) or a PDF of the bill." };
  if (file.size > SCAN_MAX_BYTES) return { error: "This file is too big. Use a file under 4 MB, or take a photo of the bill instead." };
  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    return { scan: await scanBill({ data, mimeType: file.type }) };
  } catch (err) {
    if (err instanceof BillScanError) return { error: err.message };
    console.error("[bills] scan failed:", err instanceof Error ? err.message : err);
    return { error: "Could not read the bill. Please try again, or enter it by hand." };
  }
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

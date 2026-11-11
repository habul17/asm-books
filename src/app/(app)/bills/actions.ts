"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isScanMimeType, SCAN_MAX_BYTES } from "@/lib/bills/scan";
import { parseBillInput } from "@/lib/bills/validation";
import { isOwner, requireUser } from "@/server/auth";
import { BillScanError, scanBill, type BillScanResult } from "@/server/bill-scan";
import { BillInputError, cancelBill, createBill, updateBill } from "@/server/bill-writes";
import { pickBillItems } from "@/server/bills";
import { pickVendors } from "@/server/vendors";

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

// Lookups for the bill editor. They only read data.

export async function findVendors(query: unknown) {
  return pickVendors(typeof query === "string" ? query : "");
}

export async function findBillItems(query: unknown) {
  return pickBillItems(typeof query === "string" ? query : "");
}

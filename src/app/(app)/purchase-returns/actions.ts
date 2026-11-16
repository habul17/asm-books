"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parsePurchaseReturnInput } from "@/lib/purchase-returns/validation";
import { isOwner, requireUser } from "@/server/auth";
import { claimScan, scanIdOf } from "@/server/document-writes";
import { scanPurchaseReturn, type PurchaseReturnScanResult } from "@/server/bill-scan/returned";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import {
  cancelPurchaseReturn,
  createPurchaseReturn,
  deletePurchaseReturn,
  PurchaseReturnInputError,
} from "@/server/purchase-return-writes";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof PurchaseReturnInputError) return { error: err.message };
  console.error(`[purchase-returns] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Records a purchase return, then opens it. Returns are never edited; a wrong one is cancelled. */
export async function savePurchaseReturn(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parsePurchaseReturnInput(input);
  if (parsed.error !== undefined) return { error: parsed.error };
  let id: number;
  try {
    id = await createPurchaseReturn(parsed.value, user.id);
  } catch (err) {
    return failure("save", err);
  }
  // A scanned paper used to fill the form is attached to what was saved.
  await claimScan(scanIdOf(input), { purchaseReturnId: id }, user);
  redirect(`/purchase-returns/${id}`);
}

export async function cancelPurchaseReturnAction(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can cancel. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Purchase return not found." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Please give a reason for cancelling." };
  if (reason.length > 500) return { error: "Reason can be at most 500 characters." };
  try {
    await cancelPurchaseReturn(id, reason, user.id);
  } catch (err) {
    return failure("cancel", err);
  }
  refresh();
  return { ok: true };
}

/** Deletes it (the newest for good, an older one kept as cancelled), then goes back to the list. Owner only. */
export async function deletePurchaseReturnAction(id: number): Promise<ActionState & { href?: string }> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can delete. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Not found." };
  try {
    await deletePurchaseReturn(id, user.id);
  } catch (err) {
    return failure("delete", err);
  }
  return { href: "/purchase-returns" };
}

/**
 * Reads the parts going back to a supplier (their credit note or a return slip) and returns
 * rows to check. Nothing is saved, and the file is not kept.
 */
export async function scanPurchaseReturnAction(formData: FormData): Promise<ScanAnswer<PurchaseReturnScanResult>> {
  const user = await requireUser();
  return scanUpload(formData, "return slip", (file) => scanPurchaseReturn(file), {
    user,
    folder: "returns",
    title: "Return slip scan",
  });
}

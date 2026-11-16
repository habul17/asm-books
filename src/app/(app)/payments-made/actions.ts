"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseVendorPaymentInput } from "@/lib/payments/validation";
import { isOwner, requireUser } from "@/server/auth";
import { claimScan, scanIdOf } from "@/server/document-writes";
import { scanPaidSlip, type PaidSlipResult } from "@/server/bill-scan/payment-slip";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import {
  cancelVendorPayment,
  createVendorPayment,
  updateVendorPayment,
  VendorPaymentInputError,
  deleteVendorPayment
} from "@/server/vendor-payment-writes";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof VendorPaymentInputError) return { error: err.message };
  console.error(`[payments-made] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Records a payment to a vendor (id null) or updates one, then opens it. */
export async function saveVendorPayment(id: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (id != null && !idSchema.safeParse(id).success) return { error: "Payment not found." };
  const parsed = parseVendorPaymentInput(formData);
  if (parsed.error !== undefined) return { error: parsed.error };

  let savedId: number;
  try {
    if (id == null) savedId = await createVendorPayment(parsed.value, user.id);
    else {
      await updateVendorPayment(id, parsed.value);
      savedId = id;
    }
  } catch (err) {
    return failure("save", err);
  }
  // A scanned paper used to fill the form is attached to what was saved.
  await claimScan(scanIdOf(formData), { vendorPaymentId: savedId }, user);
  redirect(`/payments-made/${savedId}`);
}

export async function cancelVendorPaymentAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can cancel. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Payment not found." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Please give a reason for cancelling." };
  if (reason.length > 500) return { error: "Reason can be at most 500 characters." };
  try {
    await cancelVendorPayment(id, reason);
  } catch (err) {
    return failure("cancel", err);
  }
  refresh();
  return { ok: true };
}

/** Reads a UPI screenshot, bank slip or cheque photo of money paid and returns values to check. Nothing is saved. */
export async function scanSlipAction(formData: FormData): Promise<ScanAnswer<PaidSlipResult>> {
  const user = await requireUser();
  return scanUpload(formData, "payment slip", scanPaidSlip, { user, folder: "payments", title: "Payment made slip" });
}

/** Deletes it for good, then goes back to the list. Owner only. */
export async function deleteVendorPaymentAction(id: number): Promise<ActionState & { href?: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Not found." };
  if (!isOwner(user)) return { error: "Only the owner can delete. Please ask the owner." };
  try {
    await deleteVendorPayment(id);
  } catch (err) {
    return failure("delete", err);
  }
  return { href: "/payments-made" };
}

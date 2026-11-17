"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parsePurchaseOrderInput, PURCHASE_ORDER_STATUSES, type PurchaseOrderStatus } from "@/lib/purchase-orders/validation";
import { isOwner, requireUser } from "@/server/auth";
import { scanBill, type BillScanResult } from "@/server/bill-scan";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import { claimScan, scanIdOf } from "@/server/document-writes";
import { BillInputError } from "@/server/bill-writes";
import { createPurchaseOrder, deletePurchaseOrder, setPurchaseOrderStatus, updatePurchaseOrder } from "@/server/purchase-order-writes";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof BillInputError) return { error: err.message };
  console.error(`[purchase-orders] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Creates a purchase order (id null) or updates one, then opens it. */
export async function savePurchaseOrder(id: number | null, input: unknown): Promise<ActionState> {
  const user = await requireUser();
  if (id != null && !idSchema.safeParse(id).success) return { error: "Purchase order not found." };
  const parsed = parsePurchaseOrderInput(input);
  if (parsed.error !== undefined) return { error: parsed.error };

  let savedId: number;
  try {
    if (id == null) savedId = await createPurchaseOrder(parsed.value, user.id);
    else {
      await updatePurchaseOrder(id, parsed.value);
      savedId = id;
    }
  } catch (err) {
    return failure("save", err);
  }
  await claimScan(scanIdOf(input), { purchaseOrderId: savedId }, user);
  redirect(`/purchase-orders/${savedId}`);
}

/** Reads a parts list or a supplier's quotation for a new purchase order, keeping a copy for Documents. */
export async function scanOrderListAction(formData: FormData): Promise<ScanAnswer<BillScanResult>> {
  const user = await requireUser();
  return scanUpload(formData, "list", (file) => scanBill(file), { user, folder: "purchase_orders", title: "Purchase order list" });
}

/** Closes, reopens or cancels a purchase order. */
export async function setPurchaseOrderStatusAction(id: number, to: PurchaseOrderStatus): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(id).success || !z.enum(PURCHASE_ORDER_STATUSES).safeParse(to).success) {
    return { error: "Purchase order not found." };
  }
  try {
    await setPurchaseOrderStatus(id, to);
  } catch (err) {
    return failure("status", err);
  }
  refresh();
  return { ok: true };
}

/** Deletes a purchase order for good, then goes back to the list. Owner only. */
export async function deletePurchaseOrderAction(id: number): Promise<ActionState & { href?: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Purchase order not found." };
  if (!isOwner(user)) return { error: "Only the owner can delete a purchase order. Please ask the owner." };
  try {
    await deletePurchaseOrder(id);
  } catch (err) {
    return failure("delete", err);
  }
  return { href: "/purchase-orders" };
}

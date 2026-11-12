"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parsePurchaseOrderInput, PURCHASE_ORDER_STATUSES, type PurchaseOrderStatus } from "@/lib/purchase-orders/validation";
import { requireUser } from "@/server/auth";
import { BillInputError } from "@/server/bill-writes";
import { createPurchaseOrder, setPurchaseOrderStatus, updatePurchaseOrder } from "@/server/purchase-order-writes";

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
  redirect(`/purchase-orders/${savedId}`);
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

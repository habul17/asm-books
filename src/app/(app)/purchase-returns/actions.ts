"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parsePurchaseReturnInput } from "@/lib/purchase-returns/validation";
import { isOwner, requireUser } from "@/server/auth";
import {
  cancelPurchaseReturn,
  createPurchaseReturn,
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

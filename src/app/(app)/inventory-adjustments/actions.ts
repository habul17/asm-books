"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseAdjustmentInput } from "@/lib/adjustments/validation";
import { AdjustmentInputError, cancelAdjustment, createAdjustment } from "@/server/adjustment-writes";
import { pickStockItems } from "@/server/adjustments";
import { isOwner, requireUser } from "@/server/auth";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof AdjustmentInputError) return { error: err.message };
  console.error(`[inventory-adjustments] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Records an adjustment, then opens it. Adjustments are never edited; a wrong one is cancelled. */
export async function saveAdjustment(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseAdjustmentInput(input);
  if (parsed.error !== undefined) return { error: parsed.error };
  let id: number;
  try {
    id = await createAdjustment(parsed.value, user.id);
  } catch (err) {
    return failure("save", err);
  }
  redirect(`/inventory-adjustments/${id}`);
}

export async function cancelAdjustmentAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can cancel. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Adjustment not found." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Please give a reason for cancelling." };
  if (reason.length > 500) return { error: "Reason can be at most 500 characters." };
  try {
    await cancelAdjustment(id, reason, user.id);
  } catch (err) {
    return failure("cancel", err);
  }
  refresh();
  return { ok: true };
}

// Lookup for the adjustment form. It only reads data.

export async function findStockItems(query: unknown) {
  return pickStockItems(typeof query === "string" ? query : "");
}

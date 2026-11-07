"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseBillInput } from "@/lib/bills/validation";
import { requireUser } from "@/server/auth";
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

// Lookups for the bill editor. They only read data.

export async function findVendors(query: unknown) {
  return pickVendors(typeof query === "string" ? query : "");
}

export async function findBillItems(query: unknown) {
  return pickBillItems(typeof query === "string" ? query : "");
}

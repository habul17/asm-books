"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseMoneyEntry } from "@/lib/banking/entries";
import { isOwner, requireUser } from "@/server/auth";
import { cancelMoneyEntry, createMoneyEntry, MoneyEntryError } from "@/server/money-entries";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();
const OWNER_ONLY = "Only the owner can use Banking. Please ask the owner.";

function failure(action: string, err: unknown): ActionState {
  if (err instanceof MoneyEntryError) return { error: err.message };
  console.error(`[banking] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Records a banking entry, then opens it. */
export async function saveMoneyEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: OWNER_ONLY };
  const parsed = parseMoneyEntry(formData);
  if (parsed.error !== undefined) return { error: parsed.error };

  let id: number;
  try {
    id = await createMoneyEntry(parsed.value, user.id);
  } catch (err) {
    return failure("save", err);
  }
  redirect(`/banking/${id}`);
}

export async function cancelMoneyEntryAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: OWNER_ONLY };
  if (!idSchema.safeParse(id).success) return { error: "Entry not found." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Please give a reason for cancelling." };
  if (reason.length > 500) return { error: "Reason can be at most 500 characters." };
  try {
    await cancelMoneyEntry(id, reason);
  } catch (err) {
    return failure("cancel", err);
  }
  refresh();
  return { ok: true };
}

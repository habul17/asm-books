"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseCreditNoteInput } from "@/lib/credit-notes/validation";
import { requireUser } from "@/server/auth";
import { cancelCreditNote, createCreditNote, CreditNoteInputError } from "@/server/credit-note-writes";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof CreditNoteInputError) return { error: err.message };
  console.error(`[credit-notes] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Records a return, then opens the new credit note. */
export async function saveCreditNote(input: unknown): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseCreditNoteInput(input);
  if (parsed.error !== undefined) return { error: parsed.error };
  let id: number;
  try {
    id = await createCreditNote(parsed.value, user.id);
  } catch (err) {
    return failure("save", err);
  }
  redirect(`/credit-notes/${id}`);
}

export async function cancelCreditNoteAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Credit note not found." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Please give a reason for cancelling." };
  if (reason.length > 500) return { error: "Reason can be at most 500 characters." };
  try {
    await cancelCreditNote(id, reason, user.id);
  } catch (err) {
    return failure("cancel", err);
  }
  refresh();
  return { ok: true };
}

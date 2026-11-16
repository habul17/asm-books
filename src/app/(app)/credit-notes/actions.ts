"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseCreditNoteInput } from "@/lib/credit-notes/validation";
import { isOwner, requireUser } from "@/server/auth";
import { scanCreditNote, type CreditNoteScanResult } from "@/server/bill-scan/returned";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import { getReturnable } from "@/server/credit-notes";
import { cancelCreditNote, createCreditNote, CreditNoteInputError, deleteCreditNote } from "@/server/credit-note-writes";

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
  if (!isOwner(user)) return { error: "Only the owner can cancel. Please ask the owner." };
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

/** Deletes it (the newest for good, an older one kept as cancelled), then goes back to the list. Owner only. */
export async function deleteCreditNoteAction(id: number): Promise<ActionState & { href?: string }> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can delete. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Not found." };
  try {
    await deleteCreditNote(id, user.id);
  } catch (err) {
    return failure("delete", err);
  }
  return { href: "/credit-notes" };
}

/**
 * Reads what the customer brought back (a slip, a chit or a voice note) and matches it to
 * the rows of the invoice. Nothing is saved, and the file is not kept.
 */
export async function scanCreditNoteAction(invoiceId: number, formData: FormData): Promise<ScanAnswer<CreditNoteScanResult>> {
  await requireUser();
  const id = z.number().int().positive().safeParse(invoiceId);
  const invoice = id.success ? await getReturnable(id.data) : null;
  if (!invoice) return { error: "Invoice not found." };
  return scanUpload(formData, "return slip", (file) => scanCreditNote(file, invoice));
}

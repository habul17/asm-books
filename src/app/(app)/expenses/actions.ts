"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseExpenseInput } from "@/lib/expenses/validation";
import { isOwner, requireUser } from "@/server/auth";
import { claimScan, scanIdOf } from "@/server/document-writes";
import { scanReceipt, type ReceiptScanResult } from "@/server/bill-scan/receipt";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import {
  cancelExpense,
  createExpense,
  updateExpense,
  ExpenseInputError,
  deleteExpense
} from "@/server/expense-writes";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof ExpenseInputError) return { error: err.message };
  console.error(`[expenses] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Records an expense (id null) or updates one, then opens it. */
export async function saveExpense(id: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (id != null && !idSchema.safeParse(id).success) return { error: "Expense not found." };
  const parsed = parseExpenseInput(formData);
  if (parsed.error !== undefined) return { error: parsed.error };

  let savedId: number;
  try {
    if (id == null) savedId = await createExpense(parsed.value, user.id);
    else {
      await updateExpense(id, parsed.value);
      savedId = id;
    }
  } catch (err) {
    return failure("save", err);
  }
  // A scanned paper used to fill the form is attached to what was saved.
  await claimScan(scanIdOf(formData), { expenseId: savedId }, user);
  redirect(`/expenses/${savedId}`);
}

export async function cancelExpenseAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can cancel. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Expense not found." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Please give a reason for cancelling." };
  if (reason.length > 500) return { error: "Reason can be at most 500 characters." };
  try {
    await cancelExpense(id, reason);
  } catch (err) {
    return failure("cancel", err);
  }
  refresh();
  return { ok: true };
}

/** Reads a photo or PDF of an expense receipt and returns values to check. Nothing is saved. */
export async function scanReceiptAction(formData: FormData): Promise<ScanAnswer<ReceiptScanResult>> {
  const user = await requireUser();
  return scanUpload(formData, "receipt", scanReceipt, { user, folder: "receipts", title: "Receipt scan" });
}

/** Deletes it for good, then goes back to the list. Owner only. */
export async function deleteExpenseAction(id: number): Promise<ActionState & { href?: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Not found." };
  if (!isOwner(user)) return { error: "Only the owner can delete. Please ask the owner." };
  try {
    await deleteExpense(id);
  } catch (err) {
    return failure("delete", err);
  }
  return { href: "/expenses" };
}

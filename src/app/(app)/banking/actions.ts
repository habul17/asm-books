"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseMoneyEntry } from "@/lib/banking/entries";
import { isOwner, requireUser } from "@/server/auth";
import { checkStatementLines, scanStatement, type LineCheck, type StatementRead } from "@/server/bank-statement";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import { cancelMoneyEntry, createMoneyEntry, MoneyEntryError, deleteMoneyEntry } from "@/server/money-entries";
import { MAX_STATEMENT_LINES } from "@/lib/banking/statement";

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

/** Reads a bank statement PDF or photo. Owner only. Nothing is saved. */
export async function scanStatementAction(formData: FormData): Promise<ScanAnswer<StatementRead>> {
  return scanUpload(formData, "bank statement", scanStatement);
}

const statementLines = z
  .array(
    z.object({
      n: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      narration: z.string().max(300),
      reference: z.string().max(100).nullable(),
      flow: z.enum(["in", "out"]),
      amount: z.number().positive().max(1e10),
    }),
  )
  .max(MAX_STATEMENT_LINES);

/** Which statement lines are already in the app, with forms for the rest. Owner only. */
export async function checkStatementAction(
  lines: unknown,
): Promise<{ checks: LineCheck[]; inApp: number; missingIn: number; missingOut: number } | { error: string }> {
  const parsed = statementLines.safeParse(lines);
  if (!parsed.success) return { error: "The statement could not be checked. Upload it again." };
  try {
    return await checkStatementLines(parsed.data);
  } catch (err) {
    console.error("[banking] statement check failed:", err instanceof Error ? err.message : err);
    return { error: "Could not check the statement. Please try again." };
  }
}

/** Deletes it for good, then goes back to the list. Owner only. */
export async function deleteMoneyEntryAction(id: number): Promise<ActionState & { href?: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Not found." };
  if (!isOwner(user)) return { error: "Only the owner can delete. Please ask the owner." };
  try {
    await deleteMoneyEntry(id);
  } catch (err) {
    return failure("delete", err);
  }
  return { href: "/banking" };
}

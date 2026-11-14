"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseInvoiceInput } from "@/lib/invoices/validation";
import { isOwner, requireUser } from "@/server/auth";
import { cancelInvoice, createInvoice, InvoiceInputError, updateInvoice } from "@/server/invoice-writes";
import { pickCustomers, pickItems, priceItems } from "@/server/invoices";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();
const listIdSchema = idSchema.nullable();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof InvoiceInputError) return { error: err.message };
  console.error(`[invoices] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Creates an invoice (id null) or updates one, then opens it. */
export async function saveInvoice(id: number | null, input: unknown): Promise<ActionState> {
  const user = await requireUser();
  if (id != null && !idSchema.safeParse(id).success) return { error: "Invoice not found." };
  const parsed = parseInvoiceInput(input);
  if (parsed.error !== undefined) return { error: parsed.error };

  let savedId: number;
  try {
    if (id == null) savedId = await createInvoice(parsed.value, user.id);
    else {
      await updateInvoice(id, parsed.value, user.id, { isOwner: isOwner(user) });
      savedId = id;
    }
  } catch (err) {
    return failure("save", err);
  }
  redirect(`/invoices/${savedId}`);
}

export async function cancelInvoiceAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can cancel. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Invoice not found." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Please give a reason for cancelling." };
  if (reason.length > 500) return { error: "Reason can be at most 500 characters." };
  try {
    await cancelInvoice(id, reason, user.id);
  } catch (err) {
    return failure("cancel", err);
  }
  refresh();
  return { ok: true };
}

// Lookups for the invoice editor. They only read data.

export async function findCustomers(query: unknown) {
  return pickCustomers(typeof query === "string" ? query : "");
}

export async function findItems(query: unknown, priceListId: unknown) {
  const list = listIdSchema.safeParse(priceListId);
  return pickItems(typeof query === "string" ? query : "", list.success ? list.data : null);
}

export async function repriceItems(productIds: unknown, priceListId: unknown) {
  const ids = z.array(idSchema).max(300).safeParse(productIds);
  const list = listIdSchema.safeParse(priceListId);
  if (!ids.success || !list.success) return [];
  return priceItems(ids.data, list.data);
}

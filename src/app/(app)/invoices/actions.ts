"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseInvoiceInput } from "@/lib/invoices/validation";
import { isOwner, requireUser } from "@/server/auth";
import { claimScan, scanIdsOf } from "@/server/document-writes";
import { scanOrder, type OrderScanResult } from "@/server/bill-scan/order";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import { cancelInvoice, createInvoice, deleteInvoice, InvoiceInputError, updateInvoice } from "@/server/invoice-writes";
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
  for (const scanId of scanIdsOf(input)) await claimScan(scanId, { invoiceId: savedId }, user);
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

/** Deletes an invoice (see deleteInvoice for how the number is kept), then goes back to the list. Owner only. */
export async function deleteInvoiceAction(id: number): Promise<ActionState & { href?: string }> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can delete. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Invoice not found." };
  try {
    await deleteInvoice(id, user.id);
  } catch (err) {
    return failure("delete", err);
  }
  return { href: "/invoices" };
}

// Lookups for the invoice editor. They only read data.

export async function findCustomers(query: unknown) {
  return pickCustomers(typeof query === "string" ? query : "");
}

export async function findItems(query: unknown, priceListId: unknown) {
  const list = listIdSchema.safeParse(priceListId);
  return pickItems(typeof query === "string" ? query : "", list.success ? list.data : null);
}

export async function repriceItems(productIds: unknown, priceListId: unknown, markupPct: unknown = null) {
  const ids = z.array(idSchema).max(300).safeParse(productIds);
  const list = listIdSchema.safeParse(priceListId);
  const markup = z.number().min(0).max(1000).nullable().safeParse(markupPct);
  if (!ids.success || !list.success || !markup.success) return [];
  return priceItems(ids.data, list.data, markup.data);
}

/**
 * Reads a customer's order (chit, WhatsApp list) and returns bill rows to check.
 * Nothing is saved.
 */
export async function scanOrderAction(
  priceListId: unknown,
  chosenCustomerId: unknown,
  formData: FormData,
): Promise<ScanAnswer<OrderScanResult>> {
  const user = await requireUser();
  const list = listIdSchema.safeParse(priceListId);
  const chosen = idSchema.safeParse(chosenCustomerId);
  // Kept only when the browser sends a copy, which it does for invoices (not quotes, orders or challans).
  return scanUpload(
    formData,
    "order",
    (file) => scanOrder(file, { listId: list.success ? list.data : null, chosenCustomerId: chosen.success ? chosen.data : null }),
    { user, folder: "orders", title: "Customer order chit" },
  );
}

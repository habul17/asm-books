"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { salesDocHref, SALES_DOC_KINDS, type SalesDocKind } from "@/lib/sales-docs/kinds";
import { parseSalesDocInput } from "@/lib/sales-docs/validation";
import { parseTransport } from "@/lib/transport";
import { requireUser } from "@/server/auth";
import { InvoiceInputError } from "@/server/invoice-writes";
import {
  createSalesDoc,
  setInvoiceTransport,
  setSalesDocStatus,
  setSalesDocTransport,
  updateSalesDoc,
} from "@/server/sales-doc-writes";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();
const kindSchema = z.enum(SALES_DOC_KINDS);

function failure(action: string, err: unknown): ActionState {
  if (err instanceof InvoiceInputError) return { error: err.message };
  console.error(`[sales-docs] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Creates a quote, sales order or delivery challan (id null) or updates one, then opens it. */
export async function saveSalesDoc(kind: SalesDocKind, id: number | null, input: unknown): Promise<ActionState> {
  const user = await requireUser();
  if (!kindSchema.safeParse(kind).success) return { error: "Not found." };
  if (id != null && !idSchema.safeParse(id).success) return { error: "Not found." };
  const parsed = parseSalesDocInput(input);
  if (parsed.error !== undefined) return { error: parsed.error };

  let savedId: number;
  try {
    if (id == null) savedId = await createSalesDoc(kind, parsed.value, user.id);
    else {
      await updateSalesDoc(kind, id, parsed.value);
      savedId = id;
    }
  } catch (err) {
    return failure("save", err);
  }
  redirect(salesDocHref(kind, savedId));
}

/** Closes, reopens or cancels a quote, sales order or delivery challan. */
export async function setSalesDocStatusAction(
  kind: SalesDocKind,
  id: number,
  to: "open" | "closed" | "cancelled",
): Promise<ActionState> {
  await requireUser();
  const valid =
    kindSchema.safeParse(kind).success &&
    idSchema.safeParse(id).success &&
    z.enum(["open", "closed", "cancelled"]).safeParse(to).success;
  if (!valid) return { error: "Not found." };
  try {
    await setSalesDocStatus(kind, id, to);
  } catch (err) {
    return failure("status", err);
  }
  refresh();
  return { ok: true };
}

/** Saves the transporter and e-way bill details of an invoice or a delivery challan. */
export async function saveTransport(
  target: "invoice" | "challan",
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  if (!z.enum(["invoice", "challan"]).safeParse(target).success || !idSchema.safeParse(id).success) {
    return { error: "Not found." };
  }
  const parsed = parseTransport(formData);
  if (parsed.error !== undefined) return { error: parsed.error };
  try {
    if (target === "invoice") await setInvoiceTransport(id, parsed.value);
    else await setSalesDocTransport(id, parsed.value);
  } catch (err) {
    return failure("transport", err);
  }
  refresh();
  return { ok: true };
}

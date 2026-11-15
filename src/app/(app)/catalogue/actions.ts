"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseMinStock } from "@/lib/catalogue/min-stock";
import { parseProduct } from "@/lib/catalogue/product-validation";
import { isOwner, requireUser } from "@/server/auth";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import { createProduct, ProductInputError, setMinStock, updateProduct } from "@/server/product-writes";
import { applyRateList, scanRateList } from "@/server/rate-list";
import type { RateReview } from "@/lib/catalogue/rate-list";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

/** Saves the "min stock" level that the Low Stock report warns about. */
export async function saveMinStock(productId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(productId).success) return { error: "Product not found." };
  const parsed = parseMinStock(formData.get("minStock"));
  if (parsed.error !== undefined) return { error: parsed.error };
  try {
    if (!(await setMinStock(productId, parsed.value))) return { error: "Product not found." };
  } catch (err) {
    console.error("[catalogue] min stock save failed:", err instanceof Error ? err.message : err);
    return { error: "Could not save. Please try again." };
  }
  refresh();
  return { ok: true };
}

/**
 * Adds a part (id null; anyone signed in) or changes one (owner only), then opens it.
 * Parts are never deleted: the owner switches them off instead, so old bills keep them.
 */
export async function saveProduct(id: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (id != null) {
    if (!idSchema.safeParse(id).success) return { error: "Product not found." };
    if (!isOwner(user)) return { error: "Only the owner can change a part. Please ask the owner." };
  }
  const form = Object.fromEntries(formData);
  if (id == null) form.active = "on";
  // An untouched purchase price box must not add a new price to the history.
  if (id != null && String(form.purchasePrice ?? "").trim() === String(form.purchasePriceWas ?? "").trim()) {
    form.purchasePrice = "";
  }
  const parsed = parseProduct(form);
  if (!parsed.value) return { error: parsed.error };

  let savedId: number;
  try {
    if (id == null) {
      savedId = await createProduct(parsed.value);
    } else {
      if (!(await updateProduct(id, parsed.value))) return { error: "Product not found." };
      savedId = id;
    }
  } catch (err) {
    if (err instanceof ProductInputError) return { error: err.message };
    console.error("[catalogue] product save failed:", err instanceof Error ? err.message : err);
    return { error: "Could not save. Please try again." };
  }
  redirect(`/catalogue?q=${encodeURIComponent(parsed.value.partNo)}&id=${savedId}`);
}

/** Reads a supplier's rate list and compares it with the parts list. Owner only. Nothing is saved. */
export async function scanRateListAction(formData: FormData): Promise<ScanAnswer<RateReview>> {
  return scanUpload(formData, "rate list", scanRateList);
}

/** Saves the rows of a rate list the owner approved. */
export async function applyRateListAction(input: unknown) {
  try {
    const result = await applyRateList(input);
    if (!("error" in result)) refresh();
    return result;
  } catch (err) {
    console.error("[catalogue] rate list save failed:", err instanceof Error ? err.message : err);
    return { error: "Could not save. Please try again." };
  }
}

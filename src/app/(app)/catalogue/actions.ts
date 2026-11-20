"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseMinStock } from "@/lib/catalogue/min-stock";
import { PART_PHOTO_MAX_BYTES } from "@/lib/catalogue/part-photo";
import { parseProduct } from "@/lib/catalogue/product-validation";
import { sniffMimeType } from "@/lib/documents/documents";
import { isOwner, requireUser } from "@/server/auth";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";
import { createProduct, ProductInputError, setMinStock, updateProduct } from "@/server/product-writes";
import { clearPartPhoto, setPartPhoto } from "@/server/product-photos";
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

export interface PhotoState {
  ok?: boolean;
  error?: string;
  /** How many related parts got the same photo. */
  shared?: number;
}

/** Puts a photo on a part (owner only), and on the chosen related parts that have none. */
export async function savePartPhoto(productId: number, formData: FormData): Promise<PhotoState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can change a part's photo." };
  if (!idSchema.safeParse(productId).success) return { error: "Product not found." };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (file.size > PART_PHOTO_MAX_BYTES) return { error: "This photo is too big. Please try another one." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffMimeType(bytes);
  if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") {
    return { error: "Please choose a JPG, PNG or WebP photo." };
  }
  const related = formData
    .getAll("related")
    .map(Number)
    .filter((n) => idSchema.safeParse(n).success);
  try {
    const saved = await setPartPhoto(productId, bytes, mimeType, related);
    if (!saved) return { error: "Product not found." };
    refresh();
    return { ok: true, shared: saved.shared };
  } catch (err) {
    console.error("[catalogue] photo save failed:", err instanceof Error ? err.message : err);
    return { error: "Could not save the photo. Please try again." };
  }
}

/** Takes the photo off a part (owner only). */
export async function removePartPhoto(productId: number): Promise<PhotoState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can change a part's photo." };
  if (!idSchema.safeParse(productId).success) return { error: "Product not found." };
  try {
    if (!(await clearPartPhoto(productId))) return { error: "Product not found." };
  } catch (err) {
    console.error("[catalogue] photo remove failed:", err instanceof Error ? err.message : err);
    return { error: "Could not remove the photo. Please try again." };
  }
  refresh();
  return { ok: true };
}

"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { parseMinStock } from "@/lib/catalogue/min-stock";
import { requireUser } from "@/server/auth";
import { setMinStock } from "@/server/product-writes";

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

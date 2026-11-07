"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";

import { getDb } from "@/db";
import { priceLists, settings } from "@/db/schema";
import { parseBusiness } from "@/lib/settings/business";
import { requireUser } from "@/server/auth";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

export async function saveBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "owner") return { error: "Only the owner can change business details." };
  const parsed = parseBusiness(formData);
  if (parsed.error !== undefined) return { error: parsed.error };
  try {
    const listId = parsed.value.defaultPriceListId;
    if (listId != null) {
      const [list] = await getDb()
        .select({ id: priceLists.id })
        .from(priceLists)
        .where(and(eq(priceLists.id, listId), isNull(priceLists.deletedAt)));
      if (!list) return { error: "Price list not found. Please choose again." };
    }
    await getDb()
      .insert(settings)
      .values({ key: "business", value: parsed.value })
      .onConflictDoUpdate({ target: settings.key, set: { value: parsed.value, updatedAt: new Date() } });
  } catch (err) {
    console.error("[settings] saveBusiness failed:", err instanceof Error ? err.message : err);
    return { error: "Could not save. Please try again." };
  }
  refresh();
  return { ok: true };
}

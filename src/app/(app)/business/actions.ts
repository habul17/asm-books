"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";

import { getDb } from "@/db";
import { priceLists, settings } from "@/db/schema";
import { DEFAULT_BUSINESS, isBusinessSection, parseBusinessSection } from "@/lib/settings/business";
import { requireUser } from "@/server/auth";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

/**
 * Saves one part of the business settings (shop, bills, numbers, bank,
 * reminders or opening balances). Only that part's keys are written; the
 * database merges them into the stored settings in one statement, so the
 * other parts are never overwritten.
 */
export async function saveBusinessSection(section: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "owner") return { error: "Only the owner can change business details." };
  if (!isBusinessSection(section)) return { error: "Unknown part of the business details." };
  const parsed = parseBusinessSection(section, formData);
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
    const part = JSON.stringify(parsed.value);
    await getDb()
      .insert(settings)
      .values({ key: "business", value: { ...DEFAULT_BUSINESS, ...parsed.value } })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: sql`${settings.value} || ${part}::jsonb`, updatedAt: new Date() },
      });
  } catch (err) {
    console.error("[business] save failed:", section, err instanceof Error ? err.message : err);
    return { error: "Could not save. Please try again." };
  }
  refresh();
  return { ok: true };
}

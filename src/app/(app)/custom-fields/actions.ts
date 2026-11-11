"use server";

import { and, eq, max } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db";
import { customFields } from "@/db/schema";
import { customFieldEntitySchema, editFieldSchema, newFieldSchema } from "@/lib/custom-fields";
import { requireUser } from "@/server/auth";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();
const FAILED = "Could not save. Please try again.";

function logError(action: string, err: unknown) {
  console.error(`[custom-fields] ${action} failed:`, err instanceof Error ? err.message : err);
}

/** Adds a field to one kind of record, after the fields it already has. */
export async function createField(entity: unknown, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const kind = customFieldEntitySchema.safeParse(entity);
  if (!kind.success) return { error: "Invalid field" };
  const parsed = newFieldSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const db = getDb();
  try {
    const [{ last }] = await db
      .select({ last: max(customFields.sort) })
      .from(customFields)
      .where(eq(customFields.entity, kind.data));
    await db.insert(customFields).values({ entity: kind.data, ...parsed.data, sort: (last ?? 0) + 1 });
  } catch (err) {
    logError("createField", err);
    return { error: FAILED };
  }
  refresh();
  return { ok: true };
}

/** Rename a field or switch it off/on. Saved values are kept either way. */
export async function updateField(
  entity: unknown,
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const kind = customFieldEntitySchema.safeParse(entity);
  if (!kind.success || !idSchema.safeParse(id).success) return { error: "Invalid field" };
  const parsed = editFieldSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const updated = await getDb()
      .update(customFields)
      .set(parsed.data)
      .where(and(eq(customFields.id, id), eq(customFields.entity, kind.data)))
      .returning({ id: customFields.id });
    if (updated.length === 0) return { error: "Field not found" };
  } catch (err) {
    logError("updateField", err);
    return { error: FAILED };
  }
  refresh();
  return { ok: true };
}

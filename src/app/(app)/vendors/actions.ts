"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { vendors } from "@/db/schema";
import { parseVendor } from "@/lib/vendors/validation";
import { requireUser } from "@/server/auth";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

/** Creates a vendor (id null) or updates one, then opens it. Vendors are never deleted. */
export async function saveVendor(id: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (id != null && !idSchema.safeParse(id).success) return { error: "Vendor not found" };
  const form = Object.fromEntries(formData);
  // A new vendor is always active; the checkbox only shows when editing.
  if (id == null) form.active = "on";
  const parsed = parseVendor(form);
  if (!parsed.value) return { error: parsed.error };

  let savedId: number;
  try {
    const db = getDb();
    if (id == null) {
      const [row] = await db.insert(vendors).values(parsed.value).returning({ id: vendors.id });
      savedId = row.id;
    } else {
      const updated = await db.update(vendors).set(parsed.value).where(eq(vendors.id, id)).returning({ id: vendors.id });
      if (updated.length === 0) return { error: "Vendor not found" };
      savedId = id;
    }
  } catch (err) {
    console.error("[vendors] save failed:", err instanceof Error ? err.message : err);
    return { error: "Could not save. Please try again." };
  }
  redirect(`/vendors/${savedId}`);
}

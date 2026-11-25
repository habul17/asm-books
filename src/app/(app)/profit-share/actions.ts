"use server";

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { MAX_SHARE_EXPENSES, parseShareExpense, readShareExpenses } from "@/lib/profit-share/share";
import { isOwner, requireUser } from "@/server/auth";
import { SHARE_EXPENSES_KEY } from "@/server/profit-share";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const OWNER_ONLY = "Only the owner can set these expenses.";
const ID = /^[0-9a-f-]{36}$/i;

/** The saved list, or an empty one if the setting holds anything else. */
const savedList = sql`case when jsonb_typeof(${settings.value}) = 'array' then ${settings.value} else '[]'::jsonb end`;

/** Adds an expense, or changes one when the form carries its id; then shows the Profit Share screen. */
export async function saveShareExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: OWNER_ONLY };
  const parsed = parseShareExpense(formData);
  if (parsed.error !== undefined) return { error: parsed.error };
  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId !== "" ? rawId : null;
  if (id != null && !ID.test(id)) return { error: "Expense not found. Please go back and try again." };

  try {
    if (id != null) {
      const item = JSON.stringify({ id, ...parsed.value });
      // One statement that swaps only this expense, so a change made at the same time elsewhere is kept.
      const changed = await getDb()
        .update(settings)
        .set({
          value: sql`(select coalesce(jsonb_agg(case when e->>'id' = ${id} then ${item}::jsonb else e end order by i), '[]'::jsonb)
            from jsonb_array_elements(${savedList}) with ordinality as t(e, i))`,
          updatedAt: new Date(),
        })
        .where(and(eq(settings.key, SHARE_EXPENSES_KEY), sql`${savedList} @> ${JSON.stringify([{ id }])}::jsonb`))
        .returning({ key: settings.key });
      if (changed.length === 0) return { error: "This expense was deleted. Go back and add it again." };
    } else {
      const newId = randomUUID();
      const item = JSON.stringify([{ id: newId, ...parsed.value }]);
      const [row] = await getDb()
        .insert(settings)
        .values({ key: SHARE_EXPENSES_KEY, value: sql`${item}::jsonb` })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: sql`case when jsonb_typeof(${settings.value}) <> 'array' then ${item}::jsonb
              when jsonb_array_length(${settings.value}) < ${MAX_SHARE_EXPENSES} then ${settings.value} || ${item}::jsonb
              else ${settings.value} end`,
            updatedAt: new Date(),
          },
        })
        .returning({ value: settings.value });
      if (!readShareExpenses(row?.value).some((e) => e.id === newId)) {
        return { error: `You can keep up to ${MAX_SHARE_EXPENSES} expenses. Delete an old one first.` };
      }
    }
  } catch (err) {
    console.error("[profit-share] save failed:", err instanceof Error ? err.message : err);
    return { error: "Could not save. Please try again." };
  }
  redirect("/profit-share");
}

/** Deletes an expense: it stops coming off the profit, for past months too. Then shows the Profit Share screen. */
export async function deleteShareExpense(id: string): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: OWNER_ONLY };
  if (typeof id !== "string" || !ID.test(id)) return { error: "Expense not found." };
  try {
    await getDb()
      .update(settings)
      .set({
        value: sql`(select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
          from jsonb_array_elements(${savedList}) with ordinality as t(e, i) where e->>'id' is distinct from ${id})`,
        updatedAt: new Date(),
      })
      .where(eq(settings.key, SHARE_EXPENSES_KEY));
  } catch (err) {
    console.error("[profit-share] delete failed:", err instanceof Error ? err.message : err);
    return { error: "Could not delete. Please try again." };
  }
  redirect("/profit-share");
}

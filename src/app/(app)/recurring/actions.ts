"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseRecurringInput } from "@/lib/recurring/schedule";
import { requireUser } from "@/server/auth";
import { createRecurring, RecurringError, setRecurringActive, skipRecurring } from "@/server/recurring";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof RecurringError) return { error: err.message };
  console.error(`[recurring] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Starts repeating an invoice, then shows the list. */
export async function saveRecurring(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseRecurringInput(formData);
  if (parsed.error !== undefined) return { error: parsed.error };
  try {
    await createRecurring(parsed.value, user.id);
  } catch (err) {
    return failure("save", err);
  }
  redirect("/recurring");
}

/** Skips the invoice that is due, stops a recurring invoice, or starts it again. */
export async function changeRecurring(id: number, change: "skip" | "stop" | "start"): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Recurring invoice not found." };
  try {
    if (change === "skip") await skipRecurring(id);
    else if (change === "stop") await setRecurringActive(id, false);
    else if (change === "start") await setRecurringActive(id, true);
    else return { error: "Please try again." };
  } catch (err) {
    return failure(change, err);
  }
  refresh();
  return { ok: true };
}

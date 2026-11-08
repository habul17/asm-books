// Input rules for saving an inventory adjustment. The form sends JSON; nothing in it is trusted.

import { z } from "zod";

export const MAX_ADJUSTMENT_LINES = 300;

/** Suggested reasons; the user may type any other. */
export const ADJUSTMENT_REASONS = [
  "Stock count correction",
  "Opening stock",
  "Damaged",
  "Lost / Stolen",
  "Used in the shop",
  "Given free / Sample",
  "Other",
] as const;

const lineSchema = z.object({
  productId: z.number().int().positive("item is not valid"),
  qty: z
    .number({ error: "quantity is not valid" })
    .refine((n) => n !== 0, "enter how many to add or take out")
    .refine((n) => Math.abs(n) <= 1_000_000, "quantity is too large")
    .refine((n) => Math.abs(Math.round(n * 1000) - n * 1000) < 1e-6, "quantity can have at most 3 decimals"),
});

export const adjustmentInputSchema = z.object({
  date: z.iso.date("Date is not valid"),
  reason: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Choose or type a reason").max(100, "Reason can be at most 100 characters")),
  notes: z.string().trim().max(2000, "Notes can be at most 2000 characters"),
  lines: z
    .array(lineSchema)
    .min(1, "Add at least one item")
    .max(MAX_ADJUSTMENT_LINES, `An adjustment can have at most ${MAX_ADJUSTMENT_LINES} items`)
    .refine((ls) => new Set(ls.map((l) => l.productId)).size === ls.length, "The same item is added twice; keep it once"),
});

export type AdjustmentInput = z.infer<typeof adjustmentInputSchema>;

/** Checks the form's data. Errors on a line say which item: "Item 3: quantity is not valid". */
export function parseAdjustmentInput(raw: unknown): { value: AdjustmentInput; error?: never } | { error: string; value?: never } {
  const parsed = adjustmentInputSchema.safeParse(raw);
  if (parsed.success) {
    const v = parsed.data;
    return { value: { ...v, lines: v.lines.map((l) => ({ ...l, qty: Math.round(l.qty * 1000) / 1000 })) } };
  }
  const issue = parsed.error.issues[0];
  if (!issue) return { error: "Please check the adjustment." };
  if (issue.path[0] === "lines" && typeof issue.path[1] === "number") {
    return { error: `Item ${issue.path[1] + 1}: ${issue.message}` };
  }
  return { error: issue.message };
}

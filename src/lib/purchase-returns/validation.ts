// Input rules for saving a purchase return (debit note). The form sends JSON; nothing in it is trusted.
import { z } from "zod";

import { isGstRate } from "@/lib/settings/business";

export const MAX_RETURN_LINES = 300;

/** Suggested reasons; the user may type any other. */
export const PURCHASE_RETURN_REASONS = ["Damaged", "Wrong part supplied", "Extra stock", "Defective", "Other"] as const;

const lineSchema = z.object({
  productId: z.number().int().positive("item is not valid"),
  qty: z
    .number({ error: "quantity is not valid" })
    .gt(0, "quantity must be more than 0")
    .max(1_000_000, "quantity is too large")
    .refine((n) => Math.abs(Math.round(n * 1000) - n * 1000) < 1e-6, "quantity can have at most 3 decimals"),
  rate: z.number({ error: "rate is not valid" }).min(0, "rate cannot be negative").max(1_000_000_000, "rate is too large"),
  discountPct: z
    .number({ error: "discount is not valid" })
    .min(0, "discount cannot be negative")
    .max(100, "discount cannot be more than 100%"),
  gstRate: z.number({ error: "GST % is not valid" }).refine(isGstRate, "GST % is not one of the allowed rates"),
});

export const purchaseReturnInputSchema = z.object({
  vendorId: z.number({ error: "Choose a vendor" }).int().positive("Choose a vendor"),
  date: z.iso.date("Date is not valid"),
  billRef: z.string().trim().max(50, "Bill number can be at most 50 characters"),
  reason: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Choose or type a reason").max(100, "Reason can be at most 100 characters")),
  notes: z.string().trim().max(2000, "Notes can be at most 2000 characters"),
  lines: z
    .array(lineSchema)
    .min(1, "Add at least one item")
    .max(MAX_RETURN_LINES, `A return can have at most ${MAX_RETURN_LINES} items`)
    .refine((ls) => new Set(ls.map((l) => l.productId)).size === ls.length, "The same item is added twice; keep it once"),
});

export type PurchaseReturnInput = z.infer<typeof purchaseReturnInputSchema>;

/** Checks the form's data. Errors on a line say which item: "Item 3: rate cannot be negative". */
export function parsePurchaseReturnInput(
  raw: unknown,
): { value: PurchaseReturnInput; error?: never } | { error: string; value?: never } {
  const parsed = purchaseReturnInputSchema.safeParse(raw);
  if (parsed.success) return { value: parsed.data };
  const issue = parsed.error.issues[0];
  if (!issue) return { error: "Please check the return." };
  if (issue.path[0] === "lines" && typeof issue.path[1] === "number") {
    return { error: `Item ${issue.path[1] + 1}: ${issue.message}` };
  }
  return { error: issue.message };
}

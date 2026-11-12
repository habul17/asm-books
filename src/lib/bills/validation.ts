// Input rules for saving a purchase bill. The editor sends JSON; nothing in it is trusted.

import { z } from "zod";

import { isGstRate } from "@/lib/settings/business";

export const MAX_BILL_LINES = 300;

export const billLineSchema = z.object({
  productId: z.number().int().positive().nullable(),
  description: z.string().trim().min(1, "description is empty").max(300, "description can be at most 300 characters"),
  qty: z.number({ error: "quantity is not valid" }).gt(0, "quantity must be more than 0").max(1_000_000, "quantity is too large"),
  rate: z.number({ error: "rate is not valid" }).min(0, "rate cannot be negative").max(1_000_000_000, "rate is too large"),
  discountPct: z.number({ error: "discount is not valid" }).min(0, "discount cannot be negative").max(100, "discount cannot be more than 100%"),
  gstRate: z.number({ error: "GST % is not valid" }).refine(isGstRate, "GST % is not one of the allowed rates"),
});

export const billInputSchema = z
  .object({
    vendorId: z.number({ error: "Choose a vendor" }).int().positive("Choose a vendor"),
    billNo: z.string().trim().min(1, "Enter the vendor's bill number").max(50, "Bill number can be at most 50 characters"),
    date: z.iso.date("Bill date is not valid"),
    dueDate: z.iso.date("Due date is not valid").nullable(),
    updatePrices: z.boolean(),
    /** False keeps the paise on the bill total, as on the supplier's bill. */
    roundTotal: z.boolean().default(true),
    notes: z.string().trim().max(2000, "Notes can be at most 2000 characters"),
    /** The purchase order this bill is for; saving the bill closes it. */
    fromOrderId: z.number().int().positive().nullable().default(null),
    lines: z.array(billLineSchema).min(1, "Add at least one item").max(MAX_BILL_LINES, `A bill can have at most ${MAX_BILL_LINES} items`),
  })
  .refine((b) => b.dueDate == null || b.dueDate >= b.date, { message: "Due date cannot be before the bill date", path: ["dueDate"] });

export type BillInput = z.infer<typeof billInputSchema>;

/** Checks the editor's data. Errors on a line say which item: "Item 3: rate cannot be negative". */
export function parseBillInput(raw: unknown): { value: BillInput; error?: never } | { error: string; value?: never } {
  const parsed = billInputSchema.safeParse(raw);
  if (parsed.success) return { value: parsed.data };
  const issue = parsed.error.issues[0];
  if (!issue) return { error: "Please check the bill." };
  if (issue.path[0] === "lines" && typeof issue.path[1] === "number") {
    return { error: `Item ${issue.path[1] + 1}: ${issue.message}` };
  }
  return { error: issue.message };
}

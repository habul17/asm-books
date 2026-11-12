// Input rules for saving a purchase order. The editor sends JSON; nothing in it is trusted.

import { z } from "zod";

import { billLineSchema, MAX_BILL_LINES } from "@/lib/bills/validation";

export const PURCHASE_ORDER_STATUSES = ["open", "closed", "cancelled"] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const purchaseOrderInputSchema = z
  .object({
    vendorId: z.number({ error: "Choose a vendor" }).int().positive("Choose a vendor"),
    date: z.iso.date("Order date is not valid"),
    expectedDate: z.iso.date("Expected date is not valid").nullable(),
    notes: z.string().trim().max(2000, "Notes can be at most 2000 characters"),
    lines: z
      .array(billLineSchema)
      .min(1, "Add at least one item")
      .max(MAX_BILL_LINES, `A purchase order can have at most ${MAX_BILL_LINES} items`),
  })
  .refine((o) => o.expectedDate == null || o.expectedDate >= o.date, {
    message: "Expected date cannot be before the order date",
    path: ["expectedDate"],
  });

export type PurchaseOrderInput = z.infer<typeof purchaseOrderInputSchema>;

/** Checks the editor's data. Errors on a line say which item: "Item 3: rate cannot be negative". */
export function parsePurchaseOrderInput(
  raw: unknown,
): { value: PurchaseOrderInput; error?: never } | { error: string; value?: never } {
  const parsed = purchaseOrderInputSchema.safeParse(raw);
  if (parsed.success) return { value: parsed.data };
  const issue = parsed.error.issues[0];
  if (!issue) return { error: "Please check the purchase order." };
  if (issue.path[0] === "lines" && typeof issue.path[1] === "number") {
    return { error: `Item ${issue.path[1] + 1}: ${issue.message}` };
  }
  return { error: issue.message };
}

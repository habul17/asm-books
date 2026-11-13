// Input rules for saving a quote, sales order or delivery challan.

import { z } from "zod";

import { invoiceInputSchema } from "@/lib/invoices/validation";

export const salesDocInputSchema = invoiceInputSchema
  .omit({ paymentType: true, cashMode: true, extra: true, fromDocId: true, repeatId: true })
  .extend({
  /** Quote: valid until. Order: deliver by. Challan: not used. */
  secondDate: z.iso.date("The second date is not valid").nullable().default(null),
  /** Challan: why the goods are moving without an invoice. */
  reason: z.string().trim().max(200, "Reason can be at most 200 characters").default(""),
  /** The quote or order this document is made from. */
  sourceId: z.number().int().positive().nullable().default(null),
});

export type SalesDocInput = z.infer<typeof salesDocInputSchema>;

/** Checks the editor's data. Errors on a line say which item: "Item 3: rate cannot be negative". */
export function parseSalesDocInput(raw: unknown): { value: SalesDocInput; error?: never } | { error: string; value?: never } {
  const parsed = salesDocInputSchema.safeParse(raw);
  if (parsed.success) {
    const { date, secondDate } = parsed.data;
    if (secondDate && secondDate < date) return { error: "The second date cannot be before the document date." };
    return { value: parsed.data };
  }
  const issue = parsed.error.issues[0];
  if (!issue) return { error: "Please check the details." };
  if (issue.path[0] === "lines" && typeof issue.path[1] === "number") {
    return { error: `Item ${issue.path[1] + 1}: ${issue.message}` };
  }
  return { error: issue.message };
}

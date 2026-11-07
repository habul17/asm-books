// Input rules for a credit note. The form sends JSON; nothing in it is trusted.

import { z } from "zod";

export const RETURN_REASONS = ["Returned by customer", "Wrong part supplied", "Damaged / defective", "Rate difference"] as const;

export const creditNoteInputSchema = z.object({
  invoiceId: z.number().int().positive(),
  date: z.iso.date("Date is not valid"),
  refundType: z.enum(["credit", "cash"], "Choose how the money goes back"),
  restock: z.boolean(),
  reason: z.string().trim().min(1, "Please give a reason for the return").max(200, "Reason can be at most 200 characters"),
  notes: z.string().trim().max(2000, "Notes can be at most 2000 characters"),
  lines: z
    .array(
      z.object({
        invoiceLineId: z.number().int().positive(),
        qty: z.number({ error: "quantity is not valid" }).gt(0, "quantity must be more than 0").max(1_000_000),
      }),
    )
    .min(1, "Enter how many of at least one item came back")
    .max(300),
});

export type CreditNoteInput = z.infer<typeof creditNoteInputSchema>;

export function parseCreditNoteInput(raw: unknown): { value: CreditNoteInput; error?: never } | { error: string; value?: never } {
  const parsed = creditNoteInputSchema.safeParse(raw);
  if (parsed.success) {
    const ids = parsed.data.lines.map((l) => l.invoiceLineId);
    if (new Set(ids).size !== ids.length) return { error: "An item is listed twice." };
    return { value: parsed.data };
  }
  const issue = parsed.error.issues[0];
  if (!issue) return { error: "Please check the credit note." };
  if (issue.path[0] === "lines" && typeof issue.path[1] === "number") {
    return { error: `Item ${issue.path[1] + 1}: ${issue.message}` };
  }
  return { error: issue.message };
}

// Checks the expense form before it reaches the database.

import { z } from "zod";

import { moneyFields, parseWith, trimmed } from "@/lib/payments/validation";
import { isGstRate } from "@/lib/settings/business";

/** Suggested categories; the user may type any other. */
export const EXPENSE_CATEGORIES = [
  "Rent",
  "Salary",
  "Electricity",
  "Freight / Transport",
  "Fuel",
  "Phone / Internet",
  "Repairs / Maintenance",
  "Office supplies",
  "Bank charges",
  "Tea / Refreshments",
  "Packing material",
  "Other",
] as const;

const expenseSchema = z.object({
  category: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""),
    z.string().min(1, "Choose or type a category").max(60, "Category can be at most 60 characters"),
  ),
  paidTo: trimmed(100, "Paid to"),
  /** A saved vendor, or null when "Paid to" is typed by hand. */
  vendorId: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number({ error: "Choose a supplier from the list" }).int().positive().nullable(),
  ),
  /** GST included in the amount; 0 when there is no GST to claim. */
  gstRate: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number({ error: "Choose a GST rate" }).refine(isGstRate, "Choose a GST rate from the list"),
  ),
  ...moneyFields("spent"),
});

/**
 * Splits the GST out of an amount that includes it. Within the state it is
 * half CGST and half SGST; from another state it is all IGST.
 */
export function expenseGst(amount: number, gstRate: number, interState: boolean) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  if (!gstRate) return { cgst: 0, sgst: 0, igst: 0 };
  const tax = r2((amount * gstRate) / (100 + gstRate));
  if (interState) return { cgst: 0, sgst: 0, igst: tax };
  const cgst = r2(tax / 2);
  return { cgst, sgst: r2(tax - cgst), igst: 0 };
}

export type ExpenseInput = z.infer<typeof expenseSchema>;

export const parseExpenseInput = (form: FormData | Record<string, unknown>) => parseWith(expenseSchema, form);

// Checks the expense form before it reaches the database.

import { z } from "zod";

import { moneyFields, parseWith, trimmed } from "@/lib/payments/validation";

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
  ...moneyFields("spent"),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export const parseExpenseInput = (form: FormData | Record<string, unknown>) => parseWith(expenseSchema, form);

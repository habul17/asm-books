// Input rules for saving an invoice. The editor sends JSON; nothing in it is trusted.

import { z } from "zod";

import { FIELD_VALUE_MAX } from "@/lib/custom-fields";
import { GST_STATES } from "@/lib/gst";
import { isGstRate } from "@/lib/settings/business";

export const MAX_LINES = 300;
const MAX_EXTRA = 100;

const lineSchema = z.object({
  productId: z.number().int().positive().nullable(),
  description: z
    .string()
    .trim()
    .min(1, "description is empty")
    .max(300, "description can be at most 300 characters"),
  qty: z.number({ error: "quantity is not valid" }).gt(0, "quantity must be more than 0").max(1_000_000, "quantity is too large"),
  rate: z.number({ error: "rate is not valid" }).min(0, "rate cannot be negative").max(1_000_000_000, "rate is too large"),
  discountPct: z.number({ error: "discount is not valid" }).min(0, "discount cannot be negative").max(100, "discount cannot be more than 100%"),
  gstRate: z.number({ error: "GST % is not valid" }).refine(isGstRate, "GST % is not one of the allowed rates"),
});

export const invoiceInputSchema = z.object({
  date: z.iso.date("Invoice date is not valid"),
  customerId: z.number().int().positive().nullable(),
  walkInName: z.string().trim().max(200, "Name can be at most 200 characters"),
  walkInMobile: z.string().trim().max(40, "Mobile can be at most 40 characters"),
  paymentType: z.enum(["credit", "cash"], "Choose credit or cash"),
  priceListId: z.number().int().positive().nullable(),
  /** State code the sale is supplied to, when the user chose it; null follows the customer's state. */
  placeOfSupply: z
    .string()
    .refine((code) => Object.hasOwn(GST_STATES, code), "Choose a valid state")
    .nullable()
    .default(null),
  notes: z.string().trim().max(2000, "Notes can be at most 2000 characters"),
  /** Custom field values as typed, keyed by field id. They are checked against the fields on the server. */
  extra: z
    .record(z.string().max(20), z.string().max(FIELD_VALUE_MAX, `A custom field can be at most ${FIELD_VALUE_MAX} characters`))
    .refine((v) => Object.keys(v).length <= MAX_EXTRA, "Too many custom fields")
    .default({}),
  lines: z.array(lineSchema).min(1, "Add at least one item").max(MAX_LINES, `An invoice can have at most ${MAX_LINES} items`),
});

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
export type InvoiceLineInput = InvoiceInput["lines"][number];

/** Checks the editor's data. Errors on a line say which item: "Item 3: rate cannot be negative". */
export function parseInvoiceInput(raw: unknown): { value: InvoiceInput; error?: never } | { error: string; value?: never } {
  const parsed = invoiceInputSchema.safeParse(raw);
  if (parsed.success) return { value: parsed.data };
  const issue = parsed.error.issues[0];
  if (!issue) return { error: "Please check the invoice." };
  if (issue.path[0] === "lines" && typeof issue.path[1] === "number") {
    return { error: `Item ${issue.path[1] + 1}: ${issue.message}` };
  }
  return { error: issue.message };
}

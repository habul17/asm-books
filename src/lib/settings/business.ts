// Business details printed on invoices, and invoice defaults.

import { z } from "zod";

import { MAX_MIN_STOCK } from "@/lib/catalogue/min-stock";
import { checkGstin, GST_STATES } from "@/lib/gst";
import { DEFAULT_REMINDER_DAYS, MAX_REMINDER_DAYS } from "@/lib/reminders/late-payments";

/** GST rates allowed on invoice lines. */
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40] as const;
export const isGstRate = (n: number) => (GST_RATES as readonly number[]).includes(n);

export interface BusinessSettings {
  name: string;
  address: string;
  city: string;
  pincode: string;
  /** Two-digit GST state code; decides CGST+SGST versus IGST on invoices. */
  stateCode: string;
  gstin: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  upiId: string;
  /** Start of every invoice number, e.g. INV → INV/26-27/0001. */
  invoicePrefix: string;
  invoiceTitle: string;
  /** Start of every payment receipt number, e.g. RCPT → RCPT/26-27/0001. */
  receiptPrefix: string;
  /** Start of every credit note number, e.g. CN → CN/26-27/0001. */
  creditNotePrefix: string;
  /** Start of every payment made to a vendor, e.g. PAY → PAY/26-27/0001. */
  vendorPaymentPrefix: string;
  /** Start of every expense number, e.g. EXP → EXP/26-27/0001. */
  expensePrefix: string;
  /** Start of every inventory adjustment number, e.g. ADJ → ADJ/26-27/0001. */
  adjustmentPrefix: string;
  /** Start of every purchase return (debit note) number, e.g. DN → DN/26-27/0001. */
  debitNotePrefix: string;
  /** Start of every quote number, e.g. QT → QT/26-27/0001. */
  quotePrefix: string;
  /** Start of every sales order number, e.g. SO → SO/26-27/0001. */
  orderPrefix: string;
  /** Start of every delivery challan number, e.g. DC → DC/26-27/0001. */
  challanPrefix: string;
  /** Start of every purchase order number, e.g. PO → PO/26-27/0001. */
  purchaseOrderPrefix: string;
  /** Printed at the bottom of every invoice. */
  terms: string;
  /** Used for products without their own GST rate. */
  defaultGstRate: number;
  /** Prices walk-in sales and customers who have no price list of their own. */
  defaultPriceListId: number | null;
  /** When false, every invoice must be for a saved customer. */
  allowWalkIn: boolean;
  /** When false, an invoice cannot sell more of a part than is in stock. */
  allowShortStock: boolean;
  /** A bill with no due date raises a reminder when it is unpaid for this many days. */
  paymentReminderDays: number;
  /** Low-stock level for parts that have no minimum of their own; 0 turns it off. */
  defaultMinStock: number;
  /** Cash in hand and in the bank on the day the shop started using the app; reports count from it. */
  openingCash: number;
}

export const DEFAULT_BUSINESS: BusinessSettings = {
  name: "",
  address: "",
  city: "",
  pincode: "",
  stateCode: "",
  gstin: "",
  phone: "",
  email: "",
  bankName: "",
  bankAccount: "",
  bankIfsc: "",
  upiId: "",
  invoicePrefix: "INV",
  invoiceTitle: "Tax Invoice",
  receiptPrefix: "RCPT",
  creditNotePrefix: "CN",
  vendorPaymentPrefix: "PAY",
  expensePrefix: "EXP",
  adjustmentPrefix: "ADJ",
  debitNotePrefix: "DN",
  quotePrefix: "QT",
  orderPrefix: "SO",
  challanPrefix: "DC",
  purchaseOrderPrefix: "PO",
  terms: "",
  defaultGstRate: 18,
  defaultPriceListId: null,
  allowWalkIn: false,
  allowShortStock: false,
  paymentReminderDays: DEFAULT_REMINDER_DAYS,
  defaultMinStock: 0,
  openingCash: 0,
};

/** Largest opening cash figure accepted, either way; it only stops typing mistakes. */
const MAX_OPENING_CASH = 1_000_000_000;
const validOpeningCash = (n: number) => Number.isFinite(n) && Math.abs(n) <= MAX_OPENING_CASH;

const validReminderDays = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX_REMINDER_DAYS;
const validMinStock = (n: number) => Number.isFinite(n) && n >= 0 && n <= MAX_MIN_STOCK;

/** Reads the stored JSON safely: unknown keys are dropped and wrong types fall back to defaults. */
export function readBusiness(raw: unknown): BusinessSettings {
  const out = { ...DEFAULT_BUSINESS };
  if (!raw || typeof raw !== "object") return out;
  const stored = raw as Record<string, unknown>;
  for (const key of Object.keys(out) as (keyof BusinessSettings)[]) {
    const v = stored[key];
    if (key === "defaultPriceListId") out.defaultPriceListId = Number.isSafeInteger(v) && (v as number) > 0 ? (v as number) : null;
    else if (typeof v === typeof out[key]) (out as Record<string, unknown>)[key] = v;
  }
  if (!isGstRate(out.defaultGstRate)) out.defaultGstRate = DEFAULT_BUSINESS.defaultGstRate;
  if (!validReminderDays(out.paymentReminderDays)) out.paymentReminderDays = DEFAULT_BUSINESS.paymentReminderDays;
  if (!validMinStock(out.defaultMinStock)) out.defaultMinStock = DEFAULT_BUSINESS.defaultMinStock;
  if (!validOpeningCash(out.openingCash)) out.openingCash = DEFAULT_BUSINESS.openingCash;
  return out;
}

const text = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().max(max, `${label} can be at most ${max} characters`),
  );

/** A number prefix that falls back to `fallback` when the box is left empty. */
const prefix = (fallback: string, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || fallback : fallback),
    z.string().regex(/^[A-Z0-9]{1,6}$/, `${label} prefix: 1 to 6 letters or numbers`),
  );

const businessSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "Business name is required").max(200, "Business name can be at most 200 characters"),
  ),
  address: text(1000, "Address"),
  city: text(100, "City"),
  pincode: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s+/g, "") : ""),
    z.string().regex(/^(\d{6})?$/, "PIN code should be 6 digits"),
  ),
  stateCode: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z.string().refine((s) => s === "" || s in GST_STATES, "Choose a state from the list"),
  ),
  gstin: text(20, "GSTIN"),
  phone: text(100, "Phone"),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : ""),
    z.union([z.literal(""), z.email("Email does not look right").max(200)]),
  ),
  bankName: text(100, "Bank name"),
  bankAccount: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s+/g, "") : ""),
    z.string().regex(/^(\d{6,20})?$/, "Account number should be 6 to 20 digits"),
  ),
  bankIfsc: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : ""),
    z.string().regex(/^([A-Z]{4}0[A-Z0-9]{6})?$/, "IFSC should look like SBIN0001234"),
  ),
  upiId: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().regex(/^([\w.-]{2,256}@[a-zA-Z]{2,64})?$/, "UPI ID should look like name@bank"),
  ),
  invoicePrefix: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : ""),
    z.string().regex(/^[A-Z0-9]{1,6}$/, "Invoice prefix: 1 to 6 letters or numbers"),
  ),
  invoiceTitle: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || "Tax Invoice" : "Tax Invoice"),
    z.string().max(60, "Invoice title can be at most 60 characters"),
  ),
  receiptPrefix: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || "RCPT" : "RCPT"),
    z.string().regex(/^[A-Z0-9]{1,6}$/, "Receipt prefix: 1 to 6 letters or numbers"),
  ),
  creditNotePrefix: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || "CN" : "CN"),
    z.string().regex(/^[A-Z0-9]{1,6}$/, "Credit note prefix: 1 to 6 letters or numbers"),
  ),
  vendorPaymentPrefix: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || "PAY" : "PAY"),
    z.string().regex(/^[A-Z0-9]{1,6}$/, "Payment made prefix: 1 to 6 letters or numbers"),
  ),
  expensePrefix: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || "EXP" : "EXP"),
    z.string().regex(/^[A-Z0-9]{1,6}$/, "Expense prefix: 1 to 6 letters or numbers"),
  ),
  adjustmentPrefix: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || "ADJ" : "ADJ"),
    z.string().regex(/^[A-Z0-9]{1,6}$/, "Adjustment prefix: 1 to 6 letters or numbers"),
  ),
  debitNotePrefix: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || "DN" : "DN"),
    z.string().regex(/^[A-Z0-9]{1,6}$/, "Debit note prefix: 1 to 6 letters or numbers"),
  ),
  quotePrefix: prefix("QT", "Quote"),
  orderPrefix: prefix("SO", "Sales order"),
  challanPrefix: prefix("DC", "Delivery challan"),
  purchaseOrderPrefix: prefix("PO", "Purchase order"),
  terms: text(3000, "Terms"),
  defaultGstRate: z.preprocess(
    (v) => Number(v),
    z.number().refine(isGstRate, `Default GST must be one of ${GST_RATES.join(", ")}`),
  ),
  defaultPriceListId: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z
      .number({ error: "Choose a price list from the list" })
      .int("Choose a price list from the list")
      .positive("Choose a price list from the list")
      .nullable(),
  ),
  allowWalkIn: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  allowShortStock: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  paymentReminderDays: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : DEFAULT_REMINDER_DAYS),
    z
      .number({ error: "Days before a payment reminder should be a number" })
      .refine(validReminderDays, `Days before a payment reminder: a whole number from 1 to ${MAX_REMINDER_DAYS}`),
  ),
  defaultMinStock: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : 0),
    z
      .number({ error: "Low stock level should be a number" })
      .refine(validMinStock, "Low stock level should be 0 or more")
      .refine((n) => Number.isInteger(n * 1000), "Low stock level can have at most 3 decimals"),
  ),
  openingCash: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : 0),
    z
      .number({ error: "Opening cash and bank balance should be a number" })
      .refine(validOpeningCash, "Opening cash and bank balance is too large")
      .transform((n) => Math.round(n * 100) / 100),
  ),
});

/** Checks the settings form. A valid GSTIN sets the state. */
export function parseBusiness(form: FormData): { value: BusinessSettings; error?: never } | { error: string; value?: never } {
  const parsed = businessSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the details." };
  const value = parsed.data;
  if (value.gstin) {
    const g = checkGstin(value.gstin);
    if (!g.ok) return { error: g.error };
    value.gstin = g.gstin;
    value.stateCode = g.stateCode;
  }
  return { value };
}

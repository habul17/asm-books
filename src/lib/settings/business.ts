// Business details printed on invoices, and invoice defaults.

import { z } from "zod";

import { checkGstin, GST_STATES } from "@/lib/gst";

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
  /** Printed at the bottom of every invoice. */
  terms: string;
  /** Used for products without their own GST rate. */
  defaultGstRate: number;
  /** Prices walk-in sales and customers who have no price list of their own. */
  defaultPriceListId: number | null;
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
  terms: "",
  defaultGstRate: 18,
  defaultPriceListId: null,
};

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
  return out;
}

const text = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().max(max, `${label} can be at most ${max} characters`),
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

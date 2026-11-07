// Input rules for vendors (suppliers).

import { z } from "zod";

import {
  checkbox,
  email,
  mobile,
  MONEY_MAX,
  optionalMoney,
  optionalText,
  paymentTermsDays,
  pincode,
  stateCode,
} from "@/lib/customers/validation";
import { checkGstin } from "@/lib/gst";

export const VENDOR_NAME_MAX = 200;

const vendorSchema = z.object({
  name: z
    .string({ error: "Vendor name is required" })
    .trim()
    .min(1, "Vendor name is required")
    .max(VENDOR_NAME_MAX, `Name can be at most ${VENDOR_NAME_MAX} characters`),
  contactPerson: optionalText(200, "Contact person"),
  mobile,
  email,
  address: optionalText(1000, "Address"),
  city: optionalText(100, "City"),
  stateCode,
  pincode,
  gstin: optionalText(20, "GSTIN"),
  openingBalance: optionalMoney("Opening balance", -MONEY_MAX),
  /** "we-owe" (default) or "owes-us": the direction of the opening balance. */
  balanceSide: z.enum(["we-owe", "owes-us"]).default("we-owe"),
  paymentTermsDays,
  notes: optionalText(5000, "Notes"),
  active: checkbox,
});

/** Checks a vendor form. A valid GSTIN decides the state. */
export function parseVendor(form: Record<string, unknown>) {
  const parsed = vendorSchema.safeParse(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" } as const;
  const { balanceSide, gstin: rawGstin, openingBalance, ...data } = parsed.data;
  let gstin: string | null = null;
  let state = data.stateCode;
  if (rawGstin) {
    const g = checkGstin(rawGstin);
    if (!g.ok) return { error: g.error } as const;
    gstin = g.gstin;
    state = g.stateCode;
  }
  const amount = Math.abs(openingBalance ?? 0);
  return {
    value: { ...data, gstin, stateCode: state, openingBalance: balanceSide === "owes-us" ? -amount : amount },
  } as const;
}

export type VendorInput = NonNullable<ReturnType<typeof parseVendor>["value"]>;

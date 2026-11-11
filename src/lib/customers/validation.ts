// Input rules for customers and customer groups.

import { z } from "zod";

import { parseExtra, type CustomFieldDef, type ExtraValues } from "@/lib/custom-fields";
import { checkGstin, GST_STATES } from "@/lib/gst";

export const CUSTOMER_NAME_MAX = 200;
export const GROUP_NAME_MAX = 120;
export const MONEY_MAX = 1_000_000_000;

/** Trimmed text; empty becomes null. */
export const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : (v ?? null)),
    z.string().max(max, `${label} can be at most ${max} characters`).nullable(),
  );

const optionalId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int().positive().nullable(),
);

/** Empty → null; otherwise a number in range, rounded to paise. */
export const optionalMoney = (label: string, min: number) =>
  z.unknown().transform((v, ctx) => {
    const text = v == null ? "" : String(v).replace(/[₹,\s]/g, "");
    if (text === "") return null;
    const n = Number(text);
    const fail = (message: string) => {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    };
    if (!Number.isFinite(n)) return fail(`${label} must be a number`);
    if (n < min) return fail(min === 0 ? `${label} cannot be negative` : `${label} is too small`);
    if (n > MONEY_MAX) return fail(`${label} is too large`);
    return Math.round(n * 100) / 100;
  });

export const mobile = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[\s\-()]/g, "") || null : (v ?? null)),
  z
    .string()
    .regex(/^\+?\d{6,15}$/, "Mobile number should have 6 to 15 digits")
    .nullable(),
);

export const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() || null : (v ?? null)),
  z.email("Email does not look right").max(200).nullable(),
);

export const pincode = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/\s+/g, "") || null : (v ?? null)),
  z
    .string()
    .regex(/^\d{6}$/, "PIN code should be 6 digits")
    .nullable(),
);

export const checkbox = z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean());

export const stateCode = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z
    .string()
    .refine((c) => c in GST_STATES, "Unknown state")
    .nullable(),
);

export const paymentTermsDays = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce
    .number({ error: "Payment terms must be whole days" })
    .int("Payment terms must be whole days")
    .min(0, "Payment terms cannot be negative")
    .max(3650, "Payment terms can be at most 3650 days")
    .nullable(),
);

const customerBase = z.object({
  name: z
    .string({ error: "Customer name is required" })
    .trim()
    .min(1, "Customer name is required")
    .max(CUSTOMER_NAME_MAX, `Name can be at most ${CUSTOMER_NAME_MAX} characters`),
  contactPerson: optionalText(200, "Contact person"),
  mobile,
  email,
  address: optionalText(1000, "Address"),
  city: optionalText(100, "City"),
  stateCode,
  pincode,
  gstin: optionalText(20, "GSTIN"),
  groupId: optionalId,
  priceListId: optionalId,
  openingBalance: optionalMoney("Opening balance", -MONEY_MAX),
  /** "owes-us" (default) or "we-owe": the direction of the opening balance. */
  balanceSide: z.enum(["owes-us", "we-owe"]).default("owes-us"),
  creditLimit: optionalMoney("Credit limit", 0),
  paymentTermsDays,
  notes: optionalText(5000, "Notes"),
  active: checkbox,
});

/**
 * Checks a customer form. Custom field values arrive as `extra.<fieldId>`.
 * Values of switched-off fields are kept from `previousExtra`, so nothing is lost.
 */
export function parseCustomer(
  form: Record<string, unknown>,
  fields: CustomFieldDef[],
  previousExtra: ExtraValues = {},
) {
  const parsed = customerBase.safeParse(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" } as const;
  const { balanceSide, gstin: rawGstin, openingBalance, ...data } = parsed.data;

  let gstin: string | null = null;
  let stateCode = data.stateCode;
  if (rawGstin) {
    const g = checkGstin(rawGstin);
    if (!g.ok) return { error: g.error } as const;
    gstin = g.gstin;
    stateCode = g.stateCode; // The GSTIN decides the state.
  }

  const extra = parseExtra(fields, (fieldId) => form[`extra.${fieldId}`], previousExtra);
  if (extra.error !== undefined) return { error: extra.error } as const;

  const amount = Math.abs(openingBalance ?? 0);
  return {
    value: {
      ...data,
      gstin,
      stateCode,
      openingBalance: balanceSide === "we-owe" ? -amount : amount,
      extra: extra.value,
    },
  } as const;
}

export type CustomerInput = NonNullable<ReturnType<typeof parseCustomer>["value"]>;

export const groupSchema = z.object({
  name: z
    .string({ error: "Group name is required" })
    .trim()
    .min(1, "Group name is required")
    .max(GROUP_NAME_MAX, `Group name can be at most ${GROUP_NAME_MAX} characters`),
  priceListId: optionalId,
});

// Input rules for customers, customer groups and custom fields.

import { z } from "zod";

import { checkGstin, GST_STATES } from "@/lib/gst";

export const CUSTOMER_NAME_MAX = 200;
export const GROUP_NAME_MAX = 120;
export const FIELD_LABEL_MAX = 80;
const MONEY_MAX = 1_000_000_000;

export const CUSTOM_FIELD_TYPES = ["text", "number", "date"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface CustomFieldDef {
  id: number;
  label: string;
  type: CustomFieldType;
  active: boolean;
}

/** Trimmed text; empty becomes null. */
const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || null : (v ?? null)),
    z.string().max(max, `${label} can be at most ${max} characters`).nullable(),
  );

const optionalId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int().positive().nullable(),
);

/** Empty → null; otherwise a number in range, rounded to paise. */
const optionalMoney = (label: string, min: number) =>
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

const mobile = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[\s\-()]/g, "") || null : (v ?? null)),
  z
    .string()
    .regex(/^\+?\d{6,15}$/, "Mobile number should have 6 to 15 digits")
    .nullable(),
);

const email = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() || null : (v ?? null)),
  z.email("Email does not look right").max(200).nullable(),
);

const pincode = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/\s+/g, "") || null : (v ?? null)),
  z
    .string()
    .regex(/^\d{6}$/, "PIN code should be 6 digits")
    .nullable(),
);

const checkbox = z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean());

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
  stateCode: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z
      .string()
      .refine((c) => c in GST_STATES, "Unknown state")
      .nullable(),
  ),
  pincode,
  gstin: optionalText(20, "GSTIN"),
  groupId: optionalId,
  priceListId: optionalId,
  openingBalance: optionalMoney("Opening balance", -MONEY_MAX),
  /** "owes-us" (default) or "we-owe": the direction of the opening balance. */
  balanceSide: z.enum(["owes-us", "we-owe"]).default("owes-us"),
  creditLimit: optionalMoney("Credit limit", 0),
  paymentTermsDays: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce
      .number({ error: "Payment terms must be whole days" })
      .int("Payment terms must be whole days")
      .min(0, "Payment terms cannot be negative")
      .max(3650, "Payment terms can be at most 3650 days")
      .nullable(),
  ),
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
  previousExtra: Record<string, string | number> = {},
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

  const extra: Record<string, string | number> = {};
  for (const f of fields) {
    const key = String(f.id);
    if (!f.active) {
      if (previousExtra[key] != null && previousExtra[key] !== "") extra[key] = previousExtra[key];
      continue;
    }
    const raw = form[`extra.${f.id}`];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value === "") continue;
    if (f.type === "number") {
      const n = Number(value.replace(/,/g, ""));
      if (!Number.isFinite(n)) return { error: `${f.label} must be a number` } as const;
      extra[key] = n;
    } else if (f.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: `${f.label} must be a date` } as const;
      extra[key] = value;
    } else {
      extra[key] = value.slice(0, 1000);
    }
  }

  const amount = Math.abs(openingBalance ?? 0);
  return {
    value: {
      ...data,
      gstin,
      stateCode,
      openingBalance: balanceSide === "we-owe" ? -amount : amount,
      extra,
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

export const newFieldSchema = z.object({
  label: z
    .string({ error: "Field name is required" })
    .trim()
    .min(1, "Field name is required")
    .max(FIELD_LABEL_MAX, `Field name can be at most ${FIELD_LABEL_MAX} characters`),
  type: z.enum(CUSTOM_FIELD_TYPES, { error: "Choose text, number or date" }),
});

export const editFieldSchema = z.object({
  label: newFieldSchema.shape.label,
  active: checkbox,
});

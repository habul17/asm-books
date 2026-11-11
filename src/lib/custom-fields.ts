// Custom fields: extra boxes the business adds to its own records.
// The same rules serve every kind of record that supports them.

import { z } from "zod";

import { formatDate } from "@/lib/format";

export const FIELD_LABEL_MAX = 80;
export const FIELD_VALUE_MAX = 1000;

export const CUSTOM_FIELD_TYPES = ["text", "number", "date"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/** The records that can carry custom fields. */
export const CUSTOM_FIELD_ENTITIES = ["customer", "invoice"] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];
export const customFieldEntitySchema = z.enum(CUSTOM_FIELD_ENTITIES);

export interface CustomFieldDef {
  id: number;
  label: string;
  type: CustomFieldType;
  active: boolean;
}

/** Saved values, keyed by the field's id. */
export type ExtraValues = Record<string, string | number>;

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
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

/**
 * Checks the values typed into custom fields. `read` returns what was typed for a field.
 * Values of switched-off fields are kept from `previous`, so nothing is lost;
 * values for fields that do not exist are dropped.
 */
export function parseExtra(
  fields: CustomFieldDef[],
  read: (fieldId: number) => unknown,
  previous: ExtraValues = {},
): { value: ExtraValues; error?: never } | { error: string; value?: never } {
  const extra: ExtraValues = {};
  for (const f of fields) {
    const key = String(f.id);
    if (!f.active) {
      if (previous[key] != null && previous[key] !== "") extra[key] = previous[key];
      continue;
    }
    const raw = read(f.id);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value === "") continue;
    if (f.type === "number") {
      const n = Number(value.replace(/,/g, ""));
      if (!Number.isFinite(n)) return { error: `${f.label} must be a number` };
      extra[key] = n;
    } else if (f.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: `${f.label} must be a date` };
      extra[key] = value;
    } else {
      extra[key] = value.slice(0, FIELD_VALUE_MAX);
    }
  }
  return { value: extra };
}

/** The filled-in, switched-on fields of a record, ready to show or print. */
export function shownExtra(fields: CustomFieldDef[], extra: ExtraValues) {
  return fields
    .filter((f) => f.active && extra[String(f.id)] != null && extra[String(f.id)] !== "")
    .map((f) => {
      const v = extra[String(f.id)];
      return { id: f.id, label: f.label, value: f.type === "date" ? formatDate(String(v)) : String(v) };
    });
}

export type ShownExtra = ReturnType<typeof shownExtra>[number];

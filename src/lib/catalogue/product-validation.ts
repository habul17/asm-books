// Input rules for adding or changing a part in the parts list.

import { z } from "zod";

import { checkbox, optionalMoney, optionalText } from "@/lib/customers/validation";
import { GST_RATES } from "@/lib/settings/business";

import { parseMinStock } from "./min-stock";

export const PART_NO_MAX = 60;
export const DESCRIPTION_MAX = 300;

/** The Category box value that means "make a new category". */
export const NEW_CATEGORY = "new";
export const CATEGORY_NAME_MAX = 80;

const categoryChoice = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.union([
    z.literal(NEW_CATEGORY),
    z.coerce.number({ error: "Choose a category from the list" }).int().positive(),
  ]).nullable(),
);

const categoryName = (label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""),
    z.string().max(CATEGORY_NAME_MAX, `${label} can be at most ${CATEGORY_NAME_MAX} characters`),
  );

const productSchema = z.object({
  partNo: z
    .string({ error: "Part no is required" })
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, "Part no is required")
        .max(PART_NO_MAX, `Part no can be at most ${PART_NO_MAX} characters`),
    ),
  description: z
    .string({ error: "Description is required" })
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, "Description is required")
        .max(DESCRIPTION_MAX, `Description can be at most ${DESCRIPTION_MAX} characters`),
    ),
  brand: optionalText(100, "Brand"),
  categoryId: categoryChoice,
  newGroup: categoryName("Main group"),
  newCategory: categoryName("Category name"),
  hsn: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s/g, "") || null : (v ?? null)),
    z
      .string()
      .regex(/^\d{4}(\d{2}){0,2}$/, "HSN code should be 4, 6 or 8 numbers")
      .nullable(),
  ),
  unit: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || "Nos" : "Nos"),
    z.string().max(20, "Unit can be at most 20 characters"),
  ),
  /** Empty means "use the default GST % from Business details". */
  gstRate: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z
      .number()
      .nullable()
      .refine((r) => r == null || (GST_RATES as readonly number[]).includes(r), "Choose a GST % from the list"),
  ),
  listPrice: optionalMoney("Selling price", 0),
  purchasePrice: optionalMoney("Purchase price", 0),
  minStock: z.unknown(),
  active: checkbox,
});

/** Checks the add/edit part form. */
export function parseProduct(form: Record<string, unknown>) {
  // Boxes left out of the form count as empty.
  const parsed = productSchema.safeParse({ listPrice: "", purchasePrice: "", minStock: "", newGroup: "", newCategory: "", ...form });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" } as const;
  const minStock = parseMinStock(parsed.data.minStock);
  if (minStock.error !== undefined) return { error: minStock.error } as const;
  const { categoryId, newGroup, newCategory, ...data } = parsed.data;
  let category: { id: number } | { group: string; name: string } | null = null;
  if (categoryId === NEW_CATEGORY) {
    if (!newGroup) return { error: "Choose or type the main group for the new category" } as const;
    if (!newCategory) return { error: "Type the name of the new category" } as const;
    // The shop's list is all in capitals, so new names match it.
    category = { group: newGroup.toUpperCase(), name: newCategory.toUpperCase() };
  } else if (categoryId != null) {
    category = { id: categoryId };
  }
  return { value: { ...data, category, minStock: minStock.value } } as const;
}

export type ProductInput = NonNullable<ReturnType<typeof parseProduct>["value"]>;

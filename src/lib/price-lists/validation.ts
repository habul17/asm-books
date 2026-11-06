// Input rules for price lists and folders. Shared by the server actions and
// the tests, so every save is checked the same way.

import { z } from "zod";

import { PRICE_BASES, type PriceBase } from "@/lib/pricing";

export const NAME_MAX = 120;
export const NOTES_MAX = 2000;
export const ADJUST_MAX = 1000;
export const ROUND_MAX = 1000;
export const MANUAL_PRICE_MAX = 1_000_000_000;

/** Rounding choices offered in the form. */
export const ROUNDING_OPTIONS = [
  { value: 0, label: "No rounding" },
  { value: 0.5, label: "Nearest ₹0.50" },
  { value: 1, label: "Nearest ₹1" },
  { value: 5, label: "Nearest ₹5" },
  { value: 10, label: "Nearest ₹10" },
] as const;

const priceBases = Object.keys(PRICE_BASES) as [PriceBase, ...PriceBase[]];

const name = z
  .string({ error: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(NAME_MAX, `Name can be at most ${NAME_MAX} characters`);

/** Empty form field → null; otherwise a positive whole number. */
const optionalId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int().positive().nullable(),
);

/** Empty form field → 0. Rejects text, negatives and values above `max`. */
const percentField = (label: string, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? 0 : v),
    z.coerce
      .number({ error: `${label} must be a number` })
      .finite(`${label} must be a number`)
      .min(0, `${label} cannot be negative`)
      .max(max, `${label} can be at most ${max}`),
  );

/** Checkbox: present ("on") means true. */
const checkbox = z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean());

export const folderSchema = z.object({
  name,
  parentId: optionalId,
});

export type FolderInput = z.infer<typeof folderSchema>;

export const priceListSchema = z
  .object({
    name,
    folderId: optionalId,
    base: z.enum(priceBases, { error: "Choose a base price" }),
    adjustType: z.enum(["markup", "markdown"], { error: "Choose markup or markdown" }),
    adjustPct: percentField("Markup / markdown %", ADJUST_MAX),
    discountPct: percentField("Discount %", 100),
    roundTo: percentField("Rounding", ROUND_MAX),
    enabled: checkbox,
    notes: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(NOTES_MAX, `Notes can be at most ${NOTES_MAX} characters`).nullable().default(null),
    ),
  })
  .refine((v) => v.adjustType !== "markdown" || v.adjustPct <= 100, {
    message: "Markdown cannot be more than 100%",
    path: ["adjustPct"],
  });

export type PriceListInput = z.infer<typeof priceListSchema>;

/** A manual price; an empty value means "remove the manual price". */
export const manualPriceSchema = z.string().transform((raw, ctx) => {
  const text = raw.replace(/[₹,\s]/g, "");
  if (text === "") return null;
  const n = Number(text);
  const fail = (message: string) => {
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  };
  if (!Number.isFinite(n)) return fail("Enter a valid price");
  if (n < 0) return fail("Price cannot be negative");
  if (n > MANUAL_PRICE_MAX) return fail("Price is too large");
  return n;
});

/** First error message of a failed parse, for showing next to the form. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form";
}

/**
 * True when moving `folderId` under `newParentId` would put a folder inside
 * itself or one of its own subfolders.
 */
export function createsFolderCycle(
  folderId: number,
  newParentId: number | null,
  parentOf: (id: number) => number | null | undefined,
): boolean {
  for (let f = newParentId, guard = 0; f != null && guard < 1000; f = parentOf(f) ?? null, guard++) {
    if (f === folderId) return true;
  }
  return false;
}

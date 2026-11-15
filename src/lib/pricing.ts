// Price maths shared by the catalogue, price lists and invoices, so every
// screen arrives at the same selling price.

export const PRICE_BASES = {
  purchase: "Current purchase price",
  previous_purchase: "Previous purchase price",
  list: "List price",
  manual: "Manual prices only",
} as const;

export type PriceBase = keyof typeof PRICE_BASES;
export type AdjustType = "markup" | "markdown";

export interface PriceRule {
  base: PriceBase;
  adjustType: AdjustType;
  adjustPct: number;
  discountPct: number;
  /** Round up to the next multiple of this amount; 0 = round to paise only. */
  roundTo: number;
}

export interface PriceBases {
  purchase: number | null;
  previous_purchase: number | null;
  list: number | null;
}

export interface ComputedPrice {
  /** The base price the rule started from, or null for manual / missing. */
  base: number | null;
  price: number | null;
  /** True when a fixed price for this product overrides the rule. */
  manual: boolean;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Rounds a price up to the next multiple of `step` (₹99.10 → ₹100 for ₹1), so rounding
 * never cuts the margin. A price already on a multiple stays. Step 0 rounds to paise.
 */
export function roundTo(n: number, step: number): number {
  if (!(step > 0)) return round2(n);
  // Drop float noise first, so 100.00000000001 is not pushed up to the next step.
  const steps = Math.round((n / step) * 1e6) / 1e6;
  return round2(Math.ceil(steps) * step);
}

/** base → ± adjust % → − discount % → rounding. A manual price always wins. */
export function computePrice(
  rule: PriceRule,
  bases: PriceBases,
  manualPrice: number | null = null,
): ComputedPrice {
  if (manualPrice != null) return { base: null, price: round2(manualPrice), manual: true };
  if (rule.base === "manual") return { base: null, price: null, manual: false };

  const base = bases[rule.base];
  if (base == null || !Number.isFinite(base)) return { base: null, price: null, manual: false };

  const sign = rule.adjustType === "markdown" ? -1 : 1;
  const adjusted = base * (1 + (sign * rule.adjustPct) / 100);
  const discounted = adjusted * (1 - rule.discountPct / 100);
  return { base, price: roundTo(discounted, rule.roundTo), manual: false };
}

/**
 * The price before GST, from a price that includes GST at `gstRate` percent.
 * Kept to 10 decimal places, the precision purchase prices are stored at.
 */
export function withoutGst(priceWithGst: number, gstRate: number): number {
  return Math.round((priceWithGst / (1 + gstRate / 100)) * 1e10) / 1e10;
}

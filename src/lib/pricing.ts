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
  /** Round to the nearest multiple of this amount; 0 = round to paise only. */
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

export function roundTo(n: number, step: number): number {
  return step > 0 ? round2(Math.round(n / step) * step) : round2(n);
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

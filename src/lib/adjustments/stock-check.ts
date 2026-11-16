// A stock check: the user types what is on the shelf for the parts that differ from
// the app, and each difference becomes a line of a "Stock count correction".

import { z } from "zod";

import { MAX_ADJUSTMENT_LINES } from "./validation";

/** Most parts counted in one save. */
export const MAX_STOCK_CHECK = 5000;

export const stockCheckSchema = z.object({
  counts: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        counted: z
          .number()
          .min(0, "a count cannot be below 0")
          .max(1_000_000, "a count is too large")
          .refine((n) => Math.abs(Math.round(n * 1000) - n * 1000) < 1e-6, "a count can have at most 3 decimals"),
      }),
    )
    .min(1, "Type the shelf count for at least one part")
    .max(MAX_STOCK_CHECK, "Too many parts in one save; save in parts")
    .refine((cs) => new Set(cs.map((c) => c.productId)).size === cs.length, "A part is counted twice"),
});

export type StockCount = z.infer<typeof stockCheckSchema>["counts"][number];

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The change each count needs against the stock the app holds now, leaving out
 * parts that already match. Split into adjustments of at most the line limit.
 */
export function stockCheckLines(counts: StockCount[], stockNow: Map<number, number>): { productId: number; qty: number }[][] {
  const lines = counts
    .filter((c) => stockNow.has(c.productId))
    .map((c) => ({ productId: c.productId, qty: round3(c.counted - stockNow.get(c.productId)!) }))
    .filter((l) => l.qty !== 0);
  const chunks: { productId: number; qty: number }[][] = [];
  for (let i = 0; i < lines.length; i += MAX_ADJUSTMENT_LINES) chunks.push(lines.slice(i, i + MAX_ADJUSTMENT_LINES));
  return chunks;
}

/**
 * Compares the rates on a bill with what was paid for the same parts on the last saved bill,
 * so a price that went up or down is seen before the bill is saved.
 */

/** A part's rate on the newest saved bill that had it. */
export interface LastBillPrice {
  /** Rate after discount, before GST. */
  net: number;
  date: string;
  billNo: string;
  vendor: string;
}

export type PriceChange =
  | { kind: "same"; last: LastBillPrice }
  | { kind: "up" | "down"; last: LastBillPrice; diff: number; pct: number | null }
  | { kind: "first" };

export interface PriceSummary {
  up: number;
  down: number;
  same: number;
  first: number;
}

/** Rates closer than half a paisa are the same price. */
const SAME_WITHIN = 0.005;

/** Rate after discount, before GST, as the bill saves it. */
export const netRate = (rate: number, discountPct: number) => Math.round(rate * (1 - discountPct / 100) * 1e6) / 1e6;

/**
 * How this rate compares with the last bill: null while the rate is not entered or the
 * last bill is not known yet; "first" when the part was never on a saved bill.
 */
export function comparePrice(net: number | null, last: LastBillPrice | null | undefined): PriceChange | null {
  if (net == null || !Number.isFinite(net) || last === undefined) return null;
  if (last === null) return { kind: "first" };
  const diff = Math.round((net - last.net) * 100) / 100;
  if (Math.abs(net - last.net) < SAME_WITHIN || diff === 0) return { kind: "same", last };
  const pct = last.net > 0 ? Math.round((diff / last.net) * 1000) / 10 : null;
  return { kind: diff > 0 ? "up" : "down", last, diff: Math.abs(diff), pct: pct == null ? null : Math.abs(pct) };
}

export function summarizePrices(changes: (PriceChange | null)[]): PriceSummary {
  const sum: PriceSummary = { up: 0, down: 0, same: 0, first: 0 };
  for (const c of changes) if (c) sum[c.kind]++;
  return sum;
}

/** "4.2%" or "" when there is no earlier price to divide by. */
export const formatPct = (pct: number | null) => (pct == null ? "" : `${pct.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`);

/** How fast each part sells, compared over a period. */

export const MOVEMENT_PERIODS = [30, 90, 180, 365] as const;
export type MovementPeriod = (typeof MOVEMENT_PERIODS)[number];
export const DEFAULT_PERIOD: MovementPeriod = 90;

/** Stock that runs out within this many days at the current pace should be bought soon. */
export const BUY_SOON_DAYS = 30;

export type MovementView = "fast" | "buy" | "slow";

export interface MovementInput {
  id: number;
  partNo: string;
  description: string;
  unit: string;
  photo: string | null;
  stockQty: number;
  /** Sold in this period, less returns. */
  sold: number;
  /** Sold in the period just before, of the same length, less returns. */
  soldBefore: number;
  /** Bills it appeared on in this period. */
  bills: number;
  /** Different customers who bought it in this period. */
  customers: number;
}

export interface MovementRow extends MovementInput {
  /** Average sold per month in this period. */
  perMonth: number;
  /** Days the stock lasts at this pace; null when it did not sell. 0 when none is left. */
  daysLeft: number | null;
  /** Change against the period before: +0.5 is 50% more. Null when nothing sold before. */
  change: number | null;
}

const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places;

export function readPeriod(value: unknown): MovementPeriod {
  const n = Number(value);
  return (MOVEMENT_PERIODS as readonly number[]).includes(n) ? (n as MovementPeriod) : DEFAULT_PERIOD;
}

export function periodLabel(days: MovementPeriod): string {
  return days === 30 ? "30 days" : days === 90 ? "3 months" : days === 180 ? "6 months" : "1 year";
}

/** Adds pace, days of stock left and the change against the period before. */
export function withPace(rows: MovementInput[], days: number): MovementRow[] {
  return rows.map((r) => {
    const sold = Math.max(0, r.sold);
    const perDay = sold / days;
    return {
      ...r,
      perMonth: round(perDay * 30),
      daysLeft: perDay > 0 ? Math.max(0, Math.floor(r.stockQty / perDay)) : null,
      change: r.soldBefore > 0 ? round((sold - r.soldBefore) / r.soldBefore, 2) : null,
    };
  });
}

const byPartNo = (a: MovementRow, b: MovementRow) => a.partNo.localeCompare(b.partNo, "en", { numeric: true });

/**
 * fast: everything that sold, the most sold first.
 * buy: sold, and the stock runs out within BUY_SOON_DAYS (or is already out), the soonest first.
 * slow: on the shelf but selling least, nothing sold first, then the most stock.
 */
export function movementView(rows: MovementRow[], view: MovementView, query = ""): MovementRow[] {
  const q = query.trim().toLowerCase();
  const match = (r: MovementRow) => !q || r.partNo.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
  const list = rows.filter(match);
  if (view === "fast") return list.filter((r) => r.sold > 0).sort((a, b) => b.sold - a.sold || b.bills - a.bills || byPartNo(a, b));
  if (view === "buy")
    return list
      .filter((r) => r.sold > 0 && r.daysLeft != null && r.daysLeft < BUY_SOON_DAYS)
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || b.sold - a.sold || byPartNo(a, b));
  return list
    .filter((r) => r.stockQty > 0)
    .sort((a, b) => Math.max(0, a.sold) - Math.max(0, b.sold) || b.stockQty - a.stockQty || byPartNo(a, b));
}

// First in, first out: every purchase bill is a batch at its own cost. A sale takes
// the oldest pieces first. Because the oldest pieces go first, the stock on hand is
// always the newest pieces bought, so what is left in each batch follows from the
// stock count alone. Returns, stock counts and edits then never put batches out of step.

/** One purchase bill's row for a part. `cost` is for one piece, before GST. */
export interface Batch {
  billId: number;
  billNo: string;
  date: string;
  qty: number;
  cost: number;
}

/** Pieces still on hand from one batch. `billId` null: older stock that came from no bill (an opening count). */
export interface Lot {
  billId: number | null;
  billNo: string | null;
  date: string | null;
  left: number;
  cost: number | null;
}

/** Part of a sale: so many pieces from one batch. */
export interface Portion {
  /** null: older stock with no bill, or pieces sold beyond the stock (`short`). */
  billId: number | null;
  billNo: string | null;
  date: string | null;
  qty: number;
  cost: number | null;
  /** Sold while the stock was already at zero (only when selling short is allowed). */
  short?: boolean;
}

const q3 = (n: number) => Math.round(n * 1000) / 1000;

/** Newest first: by bill date, then the order bills were entered. */
const newestFirst = (a: Batch, b: Batch) => (a.date === b.date ? b.billId - a.billId : a.date < b.date ? 1 : -1);

/**
 * What is left of each batch, oldest first, for `stock` pieces on hand.
 * Stock beyond every bill is older stock at `olderCost` (the price known before the bills).
 */
export function lotsOnHand(batches: Batch[], stock: number, olderCost: number | null): Lot[] {
  let toPlace = q3(Math.max(stock, 0));
  const lots: Lot[] = [];
  for (const b of [...batches].sort(newestFirst)) {
    if (toPlace <= 0) break;
    const left = q3(Math.min(b.qty, toPlace));
    if (left > 0) lots.push({ billId: b.billId, billNo: b.billNo, date: b.date, left, cost: b.cost });
    toPlace = q3(toPlace - left);
  }
  if (toPlace > 0) lots.push({ billId: null, billNo: null, date: null, left: toPlace, cost: olderCost });
  return lots.reverse();
}

/** The cost of the newest bill, for pieces sold beyond the stock. */
export function newestCost(batches: Batch[], olderCost: number | null): number | null {
  return [...batches].sort(newestFirst)[0]?.cost ?? olderCost;
}

/**
 * Takes `qty` pieces from the lots, oldest first, and returns what was taken and the lots left.
 * Pieces beyond the lots are `short`, at `shortCost`.
 */
export function takeOldestFirst(lots: Lot[], qty: number, shortCost: number | null): { portions: Portion[]; rest: Lot[] } {
  let need = q3(qty);
  const portions: Portion[] = [];
  const rest: Lot[] = [];
  for (const lot of lots) {
    if (need <= 0) {
      rest.push(lot);
      continue;
    }
    const take = q3(Math.min(lot.left, need));
    portions.push({ billId: lot.billId, billNo: lot.billNo, date: lot.date, qty: take, cost: lot.cost });
    need = q3(need - take);
    if (lot.left - take > 0) rest.push({ ...lot, left: q3(lot.left - take) });
  }
  if (need > 0) portions.push({ billId: null, billNo: null, date: null, qty: need, cost: shortCost, short: true });
  return { portions, rest };
}

/** What the pieces really cost in all, or null when any cost is unknown. */
export function totalCost(portions: Portion[]): number | null {
  let sum = 0;
  for (const p of portions) {
    if (p.cost == null) return null;
    sum += p.qty * p.cost;
  }
  return sum;
}

/** Cost of one piece on average, for profit; null when unknown. */
export function unitCost(portions: Portion[]): number | null {
  const qty = portions.reduce((s, p) => s + p.qty, 0);
  const total = totalCost(portions);
  return total == null || qty <= 0 ? null : Math.round((total / qty) * 1e10) / 1e10;
}

/**
 * The selling price changes as a sale reaches newer batches. Each step is the
 * price from the `from`-th piece on (0 is the first piece).
 */
export interface PriceStep {
  from: number;
  price: number | null;
}

/** Selling price steps, oldest batch first, for the lots on hand plus pieces beyond them. */
export function priceSteps(lots: Lot[], shortCost: number | null, priceFor: (cost: number | null) => number | null): PriceStep[] {
  const steps: PriceStep[] = [];
  let from = 0;
  for (const lot of lots) {
    steps.push({ from, price: priceFor(lot.cost) });
    from = q3(from + lot.left);
  }
  steps.push({ from, price: priceFor(shortCost) });
  // Neighbouring steps at the same price are one step.
  return steps.filter((s, i) => i === 0 || s.price !== steps[i - 1].price);
}

/**
 * The rate for `qty` pieces: one row on the bill, at the highest price among the
 * batches the pieces come from. `skip` pieces are already taken by rows above it.
 */
export function rateForQty(steps: PriceStep[], qty: number, skip = 0): number | null {
  const end = skip + qty;
  let best: number | null = null;
  for (let i = 0; i < steps.length; i++) {
    const start = steps[i].from;
    const stop = steps[i + 1]?.from ?? Number.POSITIVE_INFINITY;
    const used = stop > skip && start < end;
    const price = steps[i].price;
    if (used && price != null && (best == null || price > best)) best = price;
  }
  return best;
}

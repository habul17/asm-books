// How much profit the money received brought in. Payments are taken against a
// customer, not a bill, so (as for the paid status) money settles any opening
// balance first and then the oldest bill. Each rupee settling a bill carries that
// bill's share of profit: profit (before tax) divided by the bill's grand total.

export interface ProfitBill {
  id: number;
  date: string;
  total: number;
  /** Bill profit before tax; null when a row has no purchase cost. */
  profit: number | null;
}

export interface Receipt {
  /** Payment id; null for a return credited to the account (it carries no profit). */
  paymentId: number | null;
  date: string;
  /** Orders receipts on the same day. */
  order: number;
  amount: number;
}

export interface PaymentProfit {
  /** Profit from the bills this payment settled. */
  profit: number;
  /** The bills this payment settled, oldest first, with how much went to each. */
  bills: { id: number; amount: number }[];
  /** Part of the payment that settled old dues or bills without a known cost. */
  untraced: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Profit per payment for one customer. `opening` is the opening balance
 * (positive: owed before these bills; negative: paid in advance).
 */
export function paymentProfits(bills: ProfitBill[], receipts: Receipt[], opening: number): Map<number, PaymentProfit> {
  // What the money settles, in order: old dues, then bills oldest first.
  const sinks: { id: number | null; left: number; rate: number | null }[] = [];
  if (opening > 0) sinks.push({ id: null, left: opening, rate: null });
  for (const b of [...bills].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)) {
    if (b.total > 0) sinks.push({ id: b.id, left: b.total, rate: b.profit == null ? null : b.profit / b.total });
  }

  // An advance settles bills before any payment does.
  const sources: Receipt[] = [];
  if (opening < 0) sources.push({ paymentId: null, date: "", order: 0, amount: -opening });
  sources.push(...[...receipts].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order));

  const out = new Map<number, PaymentProfit>();
  let i = 0;
  for (const r of sources) {
    let money = r.amount;
    let profit = 0;
    let untraced = 0;
    const paid: { id: number; amount: number }[] = [];
    while (money > 0.005 && i < sinks.length) {
      const sink = sinks[i];
      const take = Math.min(money, sink.left);
      if (sink.rate == null) untraced += take;
      else profit += take * sink.rate;
      if (sink.id != null) paid.push({ id: sink.id, amount: round2(take) });
      money -= take;
      sink.left -= take;
      if (sink.left <= 0.005) i++;
    }
    // Money beyond every bill is an advance: no profit yet.
    untraced += Math.max(money, 0);
    if (r.paymentId != null) out.set(r.paymentId, { profit: round2(profit), untraced: round2(untraced), bills: paid });
  }
  return out;
}

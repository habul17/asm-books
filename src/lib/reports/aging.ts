// AR aging: what customers owe, split by how old the unpaid bills are.

import { daysBetween, unpaidBills, type OpenInvoice, type OwingCustomer } from "@/lib/reminders/late-payments";

/** Age bands in days since the bill date; the last one has no upper end. */
export const AGING_BUCKETS = [
  { label: "0–30 days", upTo: 30 },
  { label: "31–60 days", upTo: 60 },
  { label: "61–90 days", upTo: 90 },
  { label: "Over 90 days", upTo: Infinity },
] as const;

export interface AgingRow {
  id: number;
  name: string;
  mobile: string | null;
  city: string | null;
  /** Amount in each band, in the order of AGING_BUCKETS. */
  buckets: number[];
  total: number;
  /** Days since the oldest unpaid bill. */
  oldestDays: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Which band a bill of this age falls in; a bill dated in the future counts as new. */
export function bucketIndex(days: number): number {
  const i = AGING_BUCKETS.findIndex((b) => days <= b.upTo);
  return i === -1 ? AGING_BUCKETS.length - 1 : i;
}

/** One row per owing customer, the largest balance first, plus the column totals. */
export function ageReceivables(customers: OwingCustomer[], invoices: OpenInvoice[], today: string) {
  const rows: AgingRow[] = unpaidBills(customers, invoices).map(({ customer, bills }) => {
    const buckets = AGING_BUCKETS.map(() => 0);
    let oldestDays = 0;
    for (const bill of bills) {
      const days = daysBetween(bill.date, today);
      const i = bucketIndex(days);
      buckets[i] = round2(buckets[i] + bill.unpaid);
      oldestDays = Math.max(oldestDays, days);
    }
    return {
      id: customer.id,
      name: customer.name,
      mobile: customer.mobile,
      city: customer.city,
      buckets,
      total: round2(buckets.reduce((sum, n) => sum + n, 0)),
      oldestDays,
    };
  });
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const totals = AGING_BUCKETS.map((_, i) => round2(rows.reduce((sum, r) => sum + r.buckets[i], 0)));
  return { rows, totals, total: round2(totals.reduce((sum, n) => sum + n, 0)) };
}

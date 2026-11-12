import { describe, expect, it } from "vitest";

import type { OpenInvoice, OwingCustomer } from "@/lib/reminders/late-payments";

import { ageReceivables, bucketIndex } from "./aging";

const TODAY = "2026-11-20";
const customer = (id: number, name: string, balance: number, since = "2026-01-01"): OwingCustomer => ({
  id,
  name,
  mobile: null,
  city: null,
  since,
  balance,
});
let nextId = 1;
const invoice = (customerId: number, date: string, grandTotal: number, newer = 0): OpenInvoice => ({
  id: nextId++,
  number: `INV/${nextId}`,
  customerId,
  date,
  dueDate: null,
  grandTotal,
  newer,
});

describe("bucketIndex", () => {
  it("puts each age in its band, with the edges in the younger band", () => {
    expect([0, 30, 31, 60, 61, 90, 91, 400].map(bucketIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(bucketIndex(-3)).toBe(0);
  });
});

describe("ageReceivables", () => {
  it("spreads a balance over its unpaid bills, oldest paid first", () => {
    // Bills of 400 (10 days), 600 (45 days), 1000 (100 days); 1200 paid, so 800 is owed.
    const rows = [
      invoice(1, "2026-11-10", 400, 0),
      invoice(1, "2026-10-06", 600, 400),
    ];
    const { rows: out, totals, total } = ageReceivables([customer(1, "Ravi", 800)], rows, TODAY);
    expect(out[0]).toMatchObject({ buckets: [400, 400, 0, 0], total: 800, oldestDays: 45 });
    expect(totals).toEqual([400, 400, 0, 0]);
    expect(total).toBe(800);
  });

  it("ages an opening balance from the day the customer was added", () => {
    const { rows } = ageReceivables([customer(1, "Old", 1500, "2026-06-01")], [invoice(1, "2026-09-01", 500)], TODAY);
    expect(rows[0].buckets).toEqual([0, 0, 500, 1000]);
    expect(rows[0].oldestDays).toBe(172);
  });

  it("lists the biggest balance first and adds up every column", () => {
    const customers = [customer(1, "Small", 100), customer(2, "Big", 900), customer(3, "Paid up", 0), customer(4, "Advance", -50)];
    const rows = [invoice(1, "2026-11-19", 100), invoice(2, "2026-08-01", 900)];
    const out = ageReceivables(customers, rows, TODAY);
    expect(out.rows.map((r) => r.name)).toEqual(["Big", "Small"]);
    expect(out.totals).toEqual([100, 0, 0, 900]);
    expect(out.total).toBe(1000);
    for (const r of out.rows) expect(r.buckets.reduce((s, n) => s + n, 0)).toBe(r.total);
  });
});

import { describe, expect, it } from "vitest";

import { paymentProfits } from "./profit";

const bill = (id: number, date: string, total: number, profit: number | null) => ({ id, date, total, profit });
const pay = (paymentId: number | null, date: string, amount: number, order = paymentId ?? 0) => ({ paymentId, date, amount, order });

describe("paymentProfits", () => {
  it("gives a full payment the bill's whole profit", () => {
    const out = paymentProfits([bill(1, "2026-11-01", 1180, 200)], [pay(7, "2026-11-05", 1180)], 0);
    expect(out.get(7)).toEqual({ profit: 200, untraced: 0 });
  });

  it("splits profit by the share of the bill paid", () => {
    const out = paymentProfits([bill(1, "2026-11-01", 1000, 100)], [pay(7, "2026-11-02", 400), pay(8, "2026-11-03", 600)], 0);
    expect(out.get(7)!.profit).toBe(40);
    expect(out.get(8)!.profit).toBe(60);
  });

  it("settles the oldest bill first, across bills", () => {
    const out = paymentProfits(
      [bill(2, "2026-11-10", 1000, 300), bill(1, "2026-11-01", 500, 50)],
      [pay(7, "2026-11-12", 1000)],
      0,
    );
    // 500 clears bill 1 (profit 50), 500 is half of bill 2 (profit 150).
    expect(out.get(7)).toEqual({ profit: 200, untraced: 0 });
  });

  it("counts old dues and advance money as untraced", () => {
    const out = paymentProfits([bill(1, "2026-11-01", 1000, 100)], [pay(7, "2026-11-02", 1500)], 300);
    // 300 old dues, 1000 clears the bill, 200 is advance.
    expect(out.get(7)).toEqual({ profit: 100, untraced: 500 });
  });

  it("lets an opening advance and a credited return settle bills before payments", () => {
    const out = paymentProfits(
      [bill(1, "2026-11-01", 1000, 100)],
      [pay(null, "2026-11-02", 200), pay(7, "2026-11-03", 800)],
      0,
    );
    expect(out.get(7)!.profit).toBe(80);
    const advance = paymentProfits([bill(1, "2026-11-01", 1000, 100)], [pay(7, "2026-11-03", 800)], -200);
    expect(advance.get(7)!.profit).toBe(80);
  });

  it("does not guess profit on a bill without a cost", () => {
    const out = paymentProfits([bill(1, "2026-11-01", 1000, null)], [pay(7, "2026-11-02", 1000)], 0);
    expect(out.get(7)).toEqual({ profit: 0, untraced: 1000 });
  });
});

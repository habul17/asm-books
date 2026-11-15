import { describe, expect, it } from "vitest";

import { lotsOnHand, newestCost, priceSteps, rateForQty, takeOldestFirst, totalCost, unitCost, type Batch } from "./fifo";

// The owner's example: Monday 5 at ₹5, Tuesday 5 at ₹10.
const mon: Batch = { billId: 1, billNo: "A1", date: "2026-11-10", qty: 5, cost: 5 };
const tue: Batch = { billId: 2, billNo: "B7", date: "2026-11-11", qty: 5, cost: 10 };

describe("lotsOnHand", () => {
  it("keeps the newest pieces: after selling 2, three ₹5 and five ₹10 are left", () => {
    expect(lotsOnHand([tue, mon], 8, null).map((l) => [l.billNo, l.left, l.cost])).toEqual([
      ["A1", 3, 5],
      ["B7", 5, 10],
    ]);
  });
  it("puts stock from no bill first, as older stock", () => {
    expect(lotsOnHand([mon], 7, 4).map((l) => [l.billNo, l.left, l.cost])).toEqual([
      [null, 2, 4],
      ["A1", 5, 5],
    ]);
  });
  it("is empty with no stock", () => {
    expect(lotsOnHand([mon, tue], 0, null)).toEqual([]);
    expect(lotsOnHand([mon, tue], -2, null)).toEqual([]);
  });
  it("orders two bills of the same day by when they were entered", () => {
    const a = { ...mon, billId: 3, date: "2026-11-12" };
    const b = { ...tue, billId: 4, date: "2026-11-12" };
    expect(lotsOnHand([b, a], 10, null).map((l) => l.billId)).toEqual([3, 4]);
  });
});

describe("takeOldestFirst", () => {
  const lots = lotsOnHand([mon, tue], 8, null);
  it("takes 3 from the old bill and 2 from the new one", () => {
    const { portions, rest } = takeOldestFirst(lots, 5, 10);
    expect(portions.map((p) => [p.billNo, p.qty, p.cost])).toEqual([
      ["A1", 3, 5],
      ["B7", 2, 10],
    ]);
    expect(totalCost(portions)).toBe(35);
    expect(unitCost(portions)).toBe(7);
    expect(rest.map((l) => [l.billNo, l.left])).toEqual([["B7", 3]]);
  });
  it("marks pieces beyond the stock as short", () => {
    const { portions } = takeOldestFirst(lots, 10, 10);
    expect(portions.at(-1)).toMatchObject({ qty: 2, short: true, cost: 10 });
  });
  it("gives no total when a cost is unknown", () => {
    expect(totalCost(takeOldestFirst(lotsOnHand([], 3, null), 2, null).portions)).toBeNull();
  });
});

describe("rateForQty: one row at the highest price of the batches used", () => {
  // Selling price = cost + 20%.
  const steps = priceSteps(lotsOnHand([mon, tue], 8, null), newestCost([mon, tue], null), (c) => (c == null ? null : c * 1.2));
  it("2 pieces all from the old bill: the old price", () => {
    expect(rateForQty(steps, 2)).toBe(6);
    expect(rateForQty(steps, 3)).toBe(6);
  });
  it("5 pieces running into the new bill: all at the new price", () => {
    expect(rateForQty(steps, 5)).toBe(12);
  });
  it("a second row of the same part starts where the first ended", () => {
    expect(rateForQty(steps, 1, 3)).toBe(12);
    expect(rateForQty(steps, 1, 2)).toBe(6);
  });
  it("with no stock, the newest bill's price", () => {
    const none = priceSteps([], newestCost([mon, tue], null), (c) => c);
    expect(rateForQty(none, 4)).toBe(10);
  });
  it("one step when every batch has the same price (e.g. an MRP price list)", () => {
    expect(priceSteps(lotsOnHand([mon, tue], 8, null), 10, () => 99)).toEqual([{ from: 0, price: 99 }]);
  });
});

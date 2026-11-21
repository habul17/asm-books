import { describe, expect, it } from "vitest";

import { movementView, readPeriod, withPace, type MovementInput } from "./movement";

const part = (over: Partial<MovementInput>): MovementInput => ({
  id: 1,
  partNo: "P1",
  description: "Part",
  unit: "Nos",
  photo: null,
  stockQty: 0,
  sold: 0,
  soldBefore: 0,
  bills: 0,
  customers: 0,
  ...over,
});

describe("withPace", () => {
  it("works out the monthly pace, days left and change", () => {
    const [r] = withPace([part({ sold: 90, soldBefore: 60, stockQty: 30 })], 90);
    expect(r.perMonth).toBe(30);
    expect(r.daysLeft).toBe(30);
    expect(r.change).toBe(0.5);
  });

  it("has no days left or change when it did not sell before", () => {
    const [r] = withPace([part({ sold: 0, stockQty: 5 })], 30);
    expect(r.daysLeft).toBeNull();
    expect(r.change).toBeNull();
    expect(withPace([part({ sold: 10, stockQty: -2 })], 30)[0].daysLeft).toBe(0);
  });
});

describe("movementView", () => {
  const rows = withPace(
    [
      part({ id: 1, partNo: "A", sold: 50, stockQty: 100, bills: 20 }),
      part({ id: 2, partNo: "B", sold: 80, stockQty: 4, bills: 10 }),
      part({ id: 3, partNo: "C", sold: 0, stockQty: 40 }),
      part({ id: 4, partNo: "D", sold: 2, stockQty: 10 }),
      part({ id: 5, partNo: "E", sold: 0, stockQty: 0 }),
    ],
    90,
  );

  it("fast: most sold first, only parts that sold", () => {
    expect(movementView(rows, "fast").map((r) => r.partNo)).toEqual(["B", "A", "D"]);
  });

  it("buy: selling parts about to run out", () => {
    expect(movementView(rows, "buy").map((r) => r.partNo)).toEqual(["B"]);
  });

  it("slow: on the shelf and selling least", () => {
    expect(movementView(rows, "slow").map((r) => r.partNo)).toEqual(["C", "D", "A", "B"]);
  });

  it("searches part no and name", () => {
    expect(movementView(rows, "fast", "b").map((r) => r.partNo)).toEqual(["B"]);
  });
});

describe("readPeriod", () => {
  it("falls back to 3 months", () => {
    expect(readPeriod("30")).toBe(30);
    expect(readPeriod("7")).toBe(90);
    expect(readPeriod(undefined)).toBe(90);
  });
});

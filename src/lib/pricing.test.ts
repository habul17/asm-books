import { describe, expect, it } from "vitest";

import { computePrice, highest, roundTo, withoutGst, type PriceRule } from "./pricing";

const bases = { purchase: 100, previous_purchase: 80, highest_purchase: 120, list: 200 };
const rule = (r: Partial<PriceRule> = {}): PriceRule => ({
  base: "purchase",
  adjustType: "markup",
  adjustPct: 0,
  discountPct: 0,
  roundTo: 0,
  ...r,
});

describe("computePrice", () => {
  it("applies markup to the chosen base", () => {
    expect(computePrice(rule({ adjustPct: 25 }), bases).price).toBe(125);
    expect(computePrice(rule({ base: "previous_purchase", adjustPct: 10 }), bases).price).toBe(88);
  });

  it("can start from the highest purchase price", () => {
    // Bought at ₹5, then ₹4, then ₹3: sell from ₹5.
    const bought = { purchase: 3, previous_purchase: 4, highest_purchase: highest(5, 4, 3), list: null };
    expect(computePrice(rule({ base: "highest_purchase" }), bought).price).toBe(5);
    expect(computePrice(rule({ base: "highest_purchase", adjustPct: 20 }), bought).price).toBe(6);
  });

  it("applies markdown and then discount", () => {
    expect(computePrice(rule({ base: "list", adjustType: "markdown", adjustPct: 10 }), bases).price).toBe(180);
    expect(computePrice(rule({ adjustPct: 20, discountPct: 10 }), bases).price).toBe(108);
  });

  it("rounds to the chosen step", () => {
    expect(computePrice(rule({ adjustPct: 13.3, roundTo: 5 }), bases).price).toBe(115);
  });

  it("uses full-precision purchase prices before rounding to paise", () => {
    expect(computePrice(rule({ adjustPct: 10 }), { ...bases, purchase: 21.7442199 }).price).toBe(23.92);
  });

  it("lets a manual price override the rule", () => {
    const result = computePrice(rule({ adjustPct: 20 }), bases, 99.5);
    expect(result).toEqual({ base: null, price: 99.5, manual: true });
  });

  it("returns no price when the base is missing or manual-only", () => {
    expect(computePrice(rule({ base: "manual" }), bases).price).toBeNull();
    expect(computePrice(rule({ base: "list" }), { purchase: 10, previous_purchase: null, highest_purchase: null, list: null }).price).toBeNull();
  });
});

describe("roundTo", () => {
  it("rounds to paise when step is 0", () => {
    expect(roundTo(10.005, 0)).toBe(10.01);
  });

  it("always rounds up to the next step", () => {
    expect(roundTo(99.6, 1)).toBe(100);
    expect(roundTo(99.1, 1)).toBe(100);
    expect(roundTo(101.01, 5)).toBe(105);
    expect(roundTo(10.2, 0.5)).toBe(10.5);
  });

  it("keeps a price that is already on a step, despite float noise", () => {
    expect(roundTo(100, 1)).toBe(100);
    expect(roundTo(1.15 * 100, 5)).toBe(115);
    expect(roundTo(0.1 + 0.2, 0.1)).toBe(0.3);
  });
});

describe("withoutGst", () => {
  it("takes GST out of a GST-inclusive price", () => {
    expect(withoutGst(118, 18)).toBe(100);
    expect(withoutGst(21.7442199, 18)).toBeCloseTo(18.427305, 5);
    expect(withoutGst(50, 0)).toBe(50);
  });
});

describe("highest", () => {
  it("ignores missing prices", () => {
    expect(highest(4, null, 5, undefined, 3)).toBe(5);
    expect(highest(null, undefined)).toBeNull();
    expect(highest()).toBeNull();
  });
});

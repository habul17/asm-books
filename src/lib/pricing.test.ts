import { describe, expect, it } from "vitest";

import { computePrice, roundTo, type PriceRule } from "./pricing";

const bases = { purchase: 100, previous_purchase: 80, list: 200 };
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
    expect(computePrice(rule({ base: "list" }), { purchase: 10, previous_purchase: null, list: null }).price).toBeNull();
  });
});

describe("roundTo", () => {
  it("rounds to paise when step is 0", () => {
    expect(roundTo(10.005, 0)).toBe(10.01);
  });
});

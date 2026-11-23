import { describe, expect, it } from "vitest";

import { itemStatus, readShow } from "./item-status";

describe("itemStatus", () => {
  it("is out when nothing is left, even if it sells", () => {
    expect(itemStatus({ stockQty: 0, sold: 50, slow: false })).toBe("out");
    expect(itemStatus({ stockQty: -2, sold: 0, slow: false })).toBe("out");
  });

  it("is buy soon when the stock lasts under 30 days at the 90-day pace", () => {
    // 90 sold in 90 days = 1 a day: 29 left lasts 29 days, 30 left lasts 30.
    expect(itemStatus({ stockQty: 29, sold: 90, slow: false })).toBe("buy");
    expect(itemStatus({ stockQty: 30, sold: 90, slow: false })).toBe("ok");
  });

  it("is slow only when the slow rule says so and it is not running out", () => {
    expect(itemStatus({ stockQty: 40, sold: 0, slow: true })).toBe("slow");
    expect(itemStatus({ stockQty: 40, sold: 0, slow: false })).toBe("ok");
  });
});

describe("readShow", () => {
  it("falls back to all", () => {
    expect(readShow("buy")).toBe("buy");
    expect(readShow("x")).toBe("all");
    expect(readShow(undefined)).toBe("all");
  });
});

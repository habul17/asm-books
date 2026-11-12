import { describe, expect, it } from "vitest";

import { parsePurchaseOrderInput } from "./validation";

const line = { productId: 3, description: "Brake pad", qty: 10, rate: 21.7442199, discountPct: 0, gstRate: 18 };
const ok = { vendorId: 1, date: "2026-11-05", expectedDate: null, notes: "", lines: [line] };

describe("parsePurchaseOrderInput", () => {
  it("accepts a valid order and keeps the exact rate", () => {
    expect(parsePurchaseOrderInput(ok).value?.lines[0].rate).toBe(21.7442199);
  });

  it("needs a vendor", () => {
    expect(parsePurchaseOrderInput({ ...ok, vendorId: null }).error).toBe("Choose a vendor");
  });

  it("says which item is wrong", () => {
    expect(parsePurchaseOrderInput({ ...ok, lines: [line, { ...line, rate: -1 }] }).error).toBe(
      "Item 2: rate cannot be negative",
    );
  });

  it("rejects an expected date before the order date", () => {
    expect(parsePurchaseOrderInput({ ...ok, expectedDate: "2026-11-01" }).error).toBe(
      "Expected date cannot be before the order date",
    );
    expect(parsePurchaseOrderInput({ ...ok, expectedDate: "2026-11-20" }).value?.expectedDate).toBe("2026-11-20");
  });

  it("needs at least one item", () => {
    expect(parsePurchaseOrderInput({ ...ok, lines: [] }).error).toBe("Add at least one item");
  });
});

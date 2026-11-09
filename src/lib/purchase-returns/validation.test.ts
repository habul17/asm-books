import { describe, expect, it } from "vitest";

import { parsePurchaseReturnInput } from "./validation";

const line = { productId: 5, qty: 2, rate: 100, discountPct: 0, gstRate: 18 };
const ok = { vendorId: 3, date: "2026-11-09", billRef: " B-12 ", reason: "  Damaged  ", notes: "", lines: [line] };

describe("parsePurchaseReturnInput", () => {
  it("accepts a normal return and tidies text", () => {
    expect(parsePurchaseReturnInput(ok).value).toMatchObject({ billRef: "B-12", reason: "Damaged" });
  });

  it("needs a vendor, a reason and at least one item", () => {
    expect(parsePurchaseReturnInput({ ...ok, vendorId: 0 }).error).toBe("Choose a vendor");
    expect(parsePurchaseReturnInput({ ...ok, reason: " " }).error).toBe("Choose or type a reason");
    expect(parsePurchaseReturnInput({ ...ok, lines: [] }).error).toBe("Add at least one item");
  });

  it("says which item is wrong", () => {
    expect(parsePurchaseReturnInput({ ...ok, lines: [line, { ...line, productId: 6, qty: 0 }] }).error).toBe(
      "Item 2: quantity must be more than 0",
    );
    expect(parsePurchaseReturnInput({ ...ok, lines: [{ ...line, gstRate: 7 }] }).error).toMatch(/^Item 1: GST/);
  });

  it("refuses the same item twice", () => {
    expect(parsePurchaseReturnInput({ ...ok, lines: [line, line] }).error).toMatch(/added twice/);
  });
});

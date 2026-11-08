import { describe, expect, it } from "vitest";

import { parseAdjustmentInput } from "./validation";

const ok = {
  date: "2026-11-08",
  reason: "  Damaged  in  transit ",
  notes: "",
  lines: [
    { productId: 5, qty: -2 },
    { productId: 9, qty: 1.5 },
  ],
};

describe("parseAdjustmentInput", () => {
  it("accepts stock taken out and added, and tidies the reason", () => {
    expect(parseAdjustmentInput(ok)).toEqual({ value: { ...ok, reason: "Damaged in transit" } });
  });

  it.each([
    [{ reason: "  " }, "Choose or type a reason"],
    [{ date: "8-11-2026" }, "Date is not valid"],
    [{ lines: [] }, "Add at least one item"],
    [{ lines: [{ productId: 5, qty: 0 }] }, "Item 1: enter how many to add or take out"],
    [{ lines: [{ productId: 5, qty: 1 }, { productId: 5, qty: 0.0001 }] }, "Item 2: quantity can have at most 3 decimals"],
    [{ lines: [{ productId: 5, qty: 2_000_000 }] }, "Item 1: quantity is too large"],
    [{ lines: [{ productId: 5, qty: "2" }] }, "Item 1: quantity is not valid"],
    [{ lines: [{ productId: 5, qty: 1 }, { productId: 5, qty: 2 }] }, "The same item is added twice; keep it once"],
  ])("rejects %j", (change, error) => {
    expect(parseAdjustmentInput({ ...ok, ...change })).toEqual({ error });
  });
});

import { describe, expect, it } from "vitest";

import { parseBillInput } from "./validation";

const line = { productId: 3, description: "Brake pad", qty: 10, rate: 21.7442199, discountPct: 0, gstRate: 18 };
const ok = {
  vendorId: 1,
  billNo: "BD/1234",
  date: "2026-11-05",
  dueDate: null,
  updatePrices: true,
  notes: "",
  lines: [line],
};

describe("parseBillInput", () => {
  it("accepts a valid bill and keeps the exact rate", () => {
    expect(parseBillInput(ok).value?.lines[0].rate).toBe(21.7442199);
  });

  it("needs a vendor and a bill number", () => {
    expect(parseBillInput({ ...ok, vendorId: null }).error).toBe("Choose a vendor");
    expect(parseBillInput({ ...ok, billNo: " " }).error).toBe("Enter the vendor's bill number");
  });

  it("says which item is wrong", () => {
    expect(parseBillInput({ ...ok, lines: [line, { ...line, qty: 0 }] }).error).toBe("Item 2: quantity must be more than 0");
  });

  it("rejects a due date before the bill date", () => {
    expect(parseBillInput({ ...ok, dueDate: "2026-11-01" }).error).toBe("Due date cannot be before the bill date");
  });

  it("links a purchase order only when one is given", () => {
    expect(parseBillInput(ok).value?.fromOrderId).toBeNull();
    expect(parseBillInput({ ...ok, fromOrderId: 7 }).value?.fromOrderId).toBe(7);
    expect(parseBillInput({ ...ok, fromOrderId: -1 }).error).toBeDefined();
  });

  it("needs at least one item", () => {
    expect(parseBillInput({ ...ok, lines: [] }).error).toBe("Add at least one item");
  });
});

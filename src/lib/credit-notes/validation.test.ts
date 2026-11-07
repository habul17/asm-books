import { describe, expect, it } from "vitest";

import { parseCreditNoteInput } from "./validation";

const ok = {
  invoiceId: 1,
  date: "2026-11-07",
  refundType: "credit",
  restock: true,
  reason: "Returned by customer",
  notes: "",
  lines: [{ invoiceLineId: 5, qty: 2 }],
};

describe("parseCreditNoteInput", () => {
  it("accepts a valid return", () => {
    expect(parseCreditNoteInput(ok).value).toEqual(ok);
  });

  it("needs at least one item", () => {
    expect(parseCreditNoteInput({ ...ok, lines: [] }).error).toBe("Enter how many of at least one item came back");
  });

  it("says which item has a bad quantity", () => {
    expect(parseCreditNoteInput({ ...ok, lines: [{ invoiceLineId: 5, qty: 0 }] }).error).toBe(
      "Item 1: quantity must be more than 0",
    );
  });

  it("needs a reason", () => {
    expect(parseCreditNoteInput({ ...ok, reason: "  " }).error).toBe("Please give a reason for the return");
  });

  it("rejects the same item twice", () => {
    const lines = [
      { invoiceLineId: 5, qty: 1 },
      { invoiceLineId: 5, qty: 1 },
    ];
    expect(parseCreditNoteInput({ ...ok, lines }).error).toBe("An item is listed twice.");
  });

  it("rejects an unknown refund type", () => {
    expect(parseCreditNoteInput({ ...ok, refundType: "card" }).error).toBe("Choose how the money goes back");
  });
});

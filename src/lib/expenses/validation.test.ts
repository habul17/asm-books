import { describe, expect, it } from "vitest";

import { parseExpenseInput } from "./validation";

const ok = {
  category: "  Freight   /  Transport ",
  paidTo: " VRL Logistics ",
  date: "2026-11-08",
  amount: "1,250",
  mode: "cash",
  reference: "",
  notes: "",
};

describe("parseExpenseInput", () => {
  it("accepts a normal expense and cleans the values", () => {
    expect(parseExpenseInput(ok)).toEqual({
      value: {
        category: "Freight / Transport",
        paidTo: "VRL Logistics",
        date: "2026-11-08",
        amount: 1250,
        mode: "cash",
        reference: "",
        notes: "",
      },
    });
  });

  it("reads FormData too", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(ok)) fd.set(k, v);
    expect(parseExpenseInput(fd).value?.category).toBe("Freight / Transport");
  });

  it.each([
    [{ category: "   " }, "Choose or type a category"],
    [{ category: "x".repeat(61) }, "Category can be at most 60 characters"],
    [{ paidTo: "x".repeat(101) }, "Paid to can be at most 100 characters"],
    [{ amount: "" }, "Enter the amount spent"],
    [{ amount: "0" }, "Amount must be more than 0"],
    [{ date: "8/11/2026" }, "Enter a valid date"],
    [{ mode: "barter" }, "Choose how it was paid"],
  ])("rejects %j", (change, error) => {
    expect(parseExpenseInput({ ...ok, ...change })).toEqual({ error });
  });
});

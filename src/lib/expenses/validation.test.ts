import { describe, expect, it } from "vitest";

import { expenseGst, parseExpenseInput } from "./validation";

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
        vendorId: null,
        gstRate: 0,
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

describe("expense GST", () => {
  it("reads the supplier and GST rate", () => {
    expect(parseExpenseInput({ ...ok, vendorId: "7", gstRate: "18" }).value).toMatchObject({ vendorId: 7, gstRate: 18 });
    expect(parseExpenseInput({ ...ok, gstRate: "7" }).error).toBeTruthy();
    expect(parseExpenseInput({ ...ok, vendorId: "abc" }).error).toBeTruthy();
  });

  it("splits GST out of the total", () => {
    // 1180 incl. 18% = 1000 + 180
    expect(expenseGst(1180, 18, false)).toEqual({ cgst: 90, sgst: 90, igst: 0 });
    expect(expenseGst(1180, 18, true)).toEqual({ cgst: 0, sgst: 0, igst: 180 });
    expect(expenseGst(1000, 0, false)).toEqual({ cgst: 0, sgst: 0, igst: 0 });
    // Odd paise go to SGST so the halves add up exactly.
    const g = expenseGst(100.01, 18, false);
    expect(Math.round((g.cgst + g.sgst) * 100) / 100).toBe(15.26);
  });
});

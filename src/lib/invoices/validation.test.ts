import { describe, expect, it } from "vitest";

import { parseInvoiceInput } from "./validation";

const line = { productId: 1, description: "Buzzer", qty: 2, rate: 30, discountPct: 0, gstRate: 18 };
const base = {
  date: "2026-11-07",
  customerId: 4,
  walkInName: "",
  walkInMobile: "",
  paymentType: "credit",
  priceListId: null,
  notes: "",
  lines: [line],
};

describe("parseInvoiceInput", () => {
  it("accepts a normal invoice", () => {
    expect(parseInvoiceInput(base).value?.lines).toHaveLength(1);
  });

  it("names the item that is wrong", () => {
    const r = parseInvoiceInput({ ...base, lines: [line, { ...line, rate: -1 }] });
    expect(r.error).toBe("Item 2: rate cannot be negative");
    expect(parseInvoiceInput({ ...base, lines: [{ ...line, gstRate: 7 }] }).error).toMatch(/^Item 1: GST/);
    expect(parseInvoiceInput({ ...base, lines: [{ ...line, qty: 0 }] }).error).toMatch(/more than 0/);
    expect(parseInvoiceInput({ ...base, lines: [{ ...line, description: "  " }] }).error).toMatch(/empty/);
  });

  it("rejects empty invoices, bad dates and odd data", () => {
    expect(parseInvoiceInput({ ...base, lines: [] }).error).toBe("Add at least one item");
    expect(parseInvoiceInput({ ...base, date: "2026-02-30" }).error).toMatch(/date/);
    expect(parseInvoiceInput({ ...base, paymentType: "upi" }).error).toMatch(/credit or cash/);
    expect(parseInvoiceInput({ ...base, lines: [{ ...line, qty: "2" }] }).error).toMatch(/quantity/);
    expect(parseInvoiceInput(null).error).toBeTruthy();
  });
});

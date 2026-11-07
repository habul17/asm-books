import { describe, expect, it } from "vitest";

import { amountInWords, calcInvoice, calcLine, financialYear, invoiceNumber, taxSummary, taxTypeFor } from "./math";

describe("financialYear", () => {
  it("runs April to March", () => {
    expect(financialYear("2026-04-01")).toBe("26-27");
    expect(financialYear("2027-03-31")).toBe("26-27");
    expect(financialYear("2026-03-31")).toBe("25-26");
    expect(financialYear("2099-12-01")).toBe("99-00");
  });
});

describe("invoiceNumber", () => {
  it("pads the sequence", () => {
    expect(invoiceNumber("INV", "26-27", 7)).toBe("INV/26-27/0007");
    expect(invoiceNumber("A", "26-27", 12345)).toBe("A/26-27/12345");
  });
});

describe("taxTypeFor", () => {
  it("uses IGST only when both states are known and differ", () => {
    expect(taxTypeFor("33", "33")).toBe("intra");
    expect(taxTypeFor("33", "29")).toBe("inter");
    expect(taxTypeFor("33", null)).toBe("intra");
    expect(taxTypeFor(null, "29")).toBe("intra");
  });
});

describe("calcLine", () => {
  it("splits GST within the state", () => {
    expect(calcLine({ qty: 3, rate: 100, discountPct: 10, gstRate: 18 }, "intra")).toEqual({
      taxable: 270,
      cgst: 24.3,
      sgst: 24.3,
      igst: 0,
      total: 318.6,
    });
  });
  it("uses IGST between states", () => {
    expect(calcLine({ qty: 1, rate: 21.74, discountPct: 0, gstRate: 18 }, "inter")).toEqual({
      taxable: 21.74,
      cgst: 0,
      sgst: 0,
      igst: 3.91,
      total: 25.65,
    });
  });
});

describe("calcInvoice", () => {
  it("rounds the grand total to rupees and records the round-off", () => {
    const { totals, lines } = calcInvoice(
      [
        { qty: 1, rate: 21.74, discountPct: 0, gstRate: 18 },
        { qty: 2, rate: 69.96, discountPct: 5, gstRate: 18 },
      ],
      "intra",
    );
    expect(lines).toHaveLength(2);
    expect(totals.taxableTotal).toBe(154.66);
    // Lines: 21.74 + 1.96 + 1.96 = 25.66 and 132.92 + 11.96 + 11.96 = 156.84 → 182.50
    expect(totals).toEqual({
      taxableTotal: 154.66,
      cgstTotal: 13.92,
      sgstTotal: 13.92,
      igstTotal: 0,
      roundOff: 0.5,
      grandTotal: 183,
    });
  });
});

describe("taxSummary", () => {
  it("groups tax by rate", () => {
    const { lines } = calcInvoice(
      [
        { qty: 1, rate: 100, discountPct: 0, gstRate: 18 },
        { qty: 1, rate: 50, discountPct: 0, gstRate: 5 },
        { qty: 1, rate: 100, discountPct: 0, gstRate: 18 },
      ],
      "intra",
    );
    expect(taxSummary(lines)).toEqual([
      { gstRate: 5, taxable: 50, cgst: 1.25, sgst: 1.25, igst: 0 },
      { gstRate: 18, taxable: 200, cgst: 18, sgst: 18, igst: 0 },
    ]);
  });
});

describe("amountInWords", () => {
  it("uses the Indian system", () => {
    expect(amountInWords(0)).toBe("Rupees Zero Only");
    expect(amountInWords(123456)).toBe("Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only");
    expect(amountInWords(10000000)).toBe("Rupees One Crore Only");
    expect(amountInWords(219.6)).toBe("Rupees Two Hundred Twenty Only");
  });
});

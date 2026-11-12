import { describe, expect, it } from "vitest";

import { asOfPresets, buildBalanceSheet, buildCashFlow, cashTotals, fyStart, parseAsOf, type BalanceInputs } from "./statements";

const moves = { cashSales: 1000.1, received: 2500.2, paidToVendors: 1800, expenses: 450.25, refunds: 100 };

describe("cash flow", () => {
  it("adds money in and money out", () => {
    expect(cashTotals(moves)).toEqual({ in: 3500.3, out: 2350.25, net: 1150.05 });
  });

  it("carries the opening balance to the closing balance", () => {
    expect(buildCashFlow(moves, 5000)).toMatchObject({ opening: 5000, net: 1150.05, closing: 6150.05 });
    const loss = buildCashFlow({ cashSales: 0, received: 100, paidToVendors: 400, expenses: 0, refunds: 0 }, 50);
    expect(loss).toMatchObject({ net: -300, closing: -250 });
  });
});

describe("dates", () => {
  it("finds the start of the financial year", () => {
    expect(fyStart("2026-11-12")).toBe("2026-04-01");
    expect(fyStart("2026-04-01")).toBe("2026-04-01");
    expect(fyStart("2026-03-31")).toBe("2025-04-01");
  });

  it("reads the balance sheet date, falling back to today", () => {
    expect(parseAsOf("2026-10-31", "2026-11-12")).toBe("2026-10-31");
    expect(parseAsOf(undefined, "2026-11-12")).toBe("2026-11-12");
    expect(parseAsOf("2026-02-30", "2026-11-12")).toBe("2026-11-12");
    expect(parseAsOf("2027-01-01", "2026-11-12")).toBe("2026-11-12");
  });

  it("offers today, last month end and last financial year end", () => {
    expect(asOfPresets("2026-11-12").map((p) => p.date)).toEqual(["2026-11-12", "2026-10-31", "2026-03-31"]);
  });
});

describe("balance sheet", () => {
  const base: BalanceInputs = {
    cash: 20_000,
    receivables: 15_000,
    customerAdvances: 1_000,
    payables: 12_000,
    vendorAdvances: 500,
    stock: 60_000,
    gstOutput: 9_000,
    gstInput: 6_500,
    profitThisYear: 8_000,
  };

  it("always balances: assets equal liabilities plus capital", () => {
    const b = buildBalanceSheet(base);
    expect(b.totalAssets).toBe(95_500);
    expect(b.liabilities.gstPayable).toBe(2_500);
    expect(b.assets.gstCredit).toBe(0);
    expect(b.totalLiabilities).toBe(15_500);
    expect(b.capital).toEqual({ profitThisYear: 8_000, earlier: 72_000, total: 80_000 });
    expect(b.totalLiabilities + b.capital.total).toBe(b.totalAssets);
  });

  it("shows GST as an asset when more was paid than charged", () => {
    const b = buildBalanceSheet({ ...base, gstOutput: 1_000, gstInput: 4_000 });
    expect(b.assets.gstCredit).toBe(3_000);
    expect(b.liabilities.gstPayable).toBe(0);
    expect(b.totalLiabilities + b.capital.total).toBe(b.totalAssets);
  });

  it("copes with a business that owes more than it has", () => {
    const b = buildBalanceSheet({ ...base, cash: -5_000, stock: 0, receivables: 0, vendorAdvances: 0, profitThisYear: -2_000 });
    expect(b.totalAssets).toBe(-5_000);
    expect(b.capital.total).toBe(-20_500);
    expect(b.capital.earlier).toBe(-18_500);
  });
});

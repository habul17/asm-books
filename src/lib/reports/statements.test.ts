import { describe, expect, it } from "vitest";

import {
  asOfPresets,
  buildBalanceSheet,
  buildCashFlow,
  cashTotals,
  fyStart,
  moneyAfter,
  NO_MOVES,
  parseAsOf,
  type BalanceInputs,
} from "./statements";

// Cash drawer: 1000.10 in cash sales, 500 of the receipts and 450.25 of expenses were cash.
const moves = { ...NO_MOVES, cashSales: 1000.1, received: 2500.2, paidToVendors: 1800, expenses: 450.25, refunds: 100, drawer: 949.85 };

describe("cash flow", () => {
  it("adds money in and money out", () => {
    expect(cashTotals(moves)).toEqual({ in: 3500.3, out: 2350.25, net: 1150.05, cash: 949.85, bank: 200.2 });
  });

  it("counts banking entries on the right side", () => {
    const t = cashTotals({
      ...NO_MOVES,
      ownerIn: 50_000,
      loansTaken: 20_000,
      otherIncome: 300,
      ownerOut: 5_000,
      loansRepaid: 2_000,
      gstPaid: 1_500,
      equipment: 12_000,
      drawer: -4_000,
    });
    expect(t).toEqual({ in: 70_300, out: 20_500, net: 49_800, cash: -4_000, bank: 53_800 });
  });

  it("carries the opening balances to the closing balances", () => {
    expect(buildCashFlow(moves, { cash: 2000, bank: 3000 })).toMatchObject({
      opening: 5000,
      net: 1150.05,
      closing: 6150.05,
      closingCash: 2949.85,
      closingBank: 3200.2,
    });
    const loss = buildCashFlow({ ...NO_MOVES, received: 100, paidToVendors: 400, drawer: 100 }, { cash: 50, bank: 0 });
    expect(loss).toMatchObject({ net: -300, closing: -250, closingCash: 150, closingBank: -400 });
  });

  it("moves cash to the bank without changing the total", () => {
    // 3000 of cash put in the bank: no money in or out, the drawer is 3000 lighter.
    const after = moneyAfter({ cash: 5000, bank: 1000 }, { ...NO_MOVES, drawer: -3000 });
    expect(after).toEqual({ cash: 2000, bank: 4000 });
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
    cashInHand: 5_000,
    bank: 15_000,
    receivables: 15_000,
    customerAdvances: 1_000,
    payables: 12_000,
    vendorAdvances: 500,
    stock: 60_000,
    equipment: 0,
    loans: 0,
    gstOutput: 9_000,
    gstInput: 6_500,
    gstPaid: 0,
    ownerMoney: 0,
    profitThisYear: 8_000,
  };
  const balances = (b: ReturnType<typeof buildBalanceSheet>) => b.totalLiabilities + b.capital.total === b.totalAssets;

  it("always balances: assets equal liabilities plus capital", () => {
    const b = buildBalanceSheet(base);
    expect(b.totalAssets).toBe(95_500);
    expect(b.liabilities.gstPayable).toBe(2_500);
    expect(b.assets.gstCredit).toBe(0);
    expect(b.totalLiabilities).toBe(15_500);
    expect(b.capital).toEqual({ profitThisYear: 8_000, ownerMoney: 0, earlier: 72_000, total: 80_000 });
    expect(balances(b)).toBe(true);
  });

  it("shows GST as an asset when more was paid than charged", () => {
    const b = buildBalanceSheet({ ...base, gstOutput: 1_000, gstInput: 4_000 });
    expect(b.assets.gstCredit).toBe(3_000);
    expect(b.liabilities.gstPayable).toBe(0);
    expect(balances(b)).toBe(true);
  });

  it("takes GST paid to the government off what is still to pay", () => {
    expect(buildBalanceSheet({ ...base, gstPaid: 2_000 }).liabilities.gstPayable).toBe(500);
    const over = buildBalanceSheet({ ...base, gstPaid: 3_000 });
    expect(over.liabilities.gstPayable).toBe(0);
    expect(over.assets.gstCredit).toBe(500);
  });

  it("shows loans, equipment and the owner's own money", () => {
    const b = buildBalanceSheet({ ...base, bank: 15_000 + 100_000 + 40_000 - 30_000, loans: 100_000, equipment: 30_000, ownerMoney: 40_000 });
    expect(b.liabilities.loans).toBe(100_000);
    expect(b.assets.equipment).toBe(30_000);
    // The loan is owed and the equipment replaced cash, so only the owner's money adds to capital.
    expect(b.capital).toEqual({ profitThisYear: 8_000, ownerMoney: 40_000, earlier: 72_000, total: 120_000 });
    expect(balances(b)).toBe(true);
    expect(buildBalanceSheet({ ...base, loans: -700 }).assets.loansOverpaid).toBe(700);
  });

  it("copes with a business that owes more than it has", () => {
    const b = buildBalanceSheet({ ...base, cashInHand: -5_000, bank: 0, stock: 0, receivables: 0, vendorAdvances: 0, profitThisYear: -2_000 });
    expect(b.totalAssets).toBe(-5_000);
    expect(b.capital.total).toBe(-20_500);
    expect(b.capital.earlier).toBe(-18_500);
  });
});

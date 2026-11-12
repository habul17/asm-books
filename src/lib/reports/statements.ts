// The arithmetic behind the Balance Sheet and the Cash Flow Statement.
//
// The app keeps no ledger, so both statements are built from the documents it
// does keep: invoices, payments, bills, expenses, returns and stock. Money the
// app is never told about (owner's own money in or out, loans, GST paid to the
// government, equipment) is left out, and the owner's capital is the balancing
// figure: what the business has, less what it owes.

import { isIsoDate, presetRange } from "./period";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Money that moved in a stretch of time, by kind. All amounts are positive. */
export interface CashMoves {
  /** Invoices paid on the spot. */
  cashSales: number;
  /** Payments received against credit sales. */
  received: number;
  paidToVendors: number;
  /** Expenses, including their GST. */
  expenses: number;
  /** Money handed back to customers for returned goods. */
  refunds: number;
}

export function cashTotals(m: CashMoves) {
  const moneyIn = round2(m.cashSales + m.received);
  const moneyOut = round2(m.paidToVendors + m.expenses + m.refunds);
  return { in: moneyIn, out: moneyOut, net: round2(moneyIn - moneyOut) };
}

/** Cash flow for a period, given the cash held at its start. */
export function buildCashFlow(moves: CashMoves, opening: number) {
  const totals = cashTotals(moves);
  return { ...moves, ...totals, opening: round2(opening), closing: round2(opening + totals.net) };
}

/** 1 April of the Indian financial year that `date` falls in. */
export function fyStart(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return `${m >= 4 ? y : y - 1}-04-01`;
}

/** The balance sheet date from the page's `?date=`; anything invalid or in the future is today. */
export function parseAsOf(raw: string | undefined, today: string): string {
  return raw && isIsoDate(raw) && raw <= today ? raw : today;
}

/** Quick dates offered on the Balance Sheet. */
export function asOfPresets(today: string): { label: string; date: string }[] {
  return [
    { label: "Today", date: today },
    { label: "End of last month", date: presetRange("last-month", today).to },
    { label: "End of last financial year", date: presetRange("last-fy", today).to },
  ];
}

export interface BalanceInputs {
  /** Cash and bank as the app knows it: opening figure plus everything in, less everything out. */
  cash: number;
  /** Total owed by customers who owe us. */
  receivables: number;
  /** Total held for customers who paid in advance. */
  customerAdvances: number;
  /** Total owed to vendors. */
  payables: number;
  /** Total paid in advance to vendors. */
  vendorAdvances: number;
  /** Stock in hand at purchase price. */
  stock: number;
  /** GST charged on sales, less returns. */
  gstOutput: number;
  /** GST paid on purchases and expenses, less purchase returns. */
  gstInput: number;
  /** Net profit from 1 April to the balance sheet date. */
  profitThisYear: number;
}

export function buildBalanceSheet(i: BalanceInputs) {
  const gst = round2(i.gstOutput - i.gstInput);
  const assets = {
    cash: round2(i.cash),
    receivables: round2(i.receivables),
    vendorAdvances: round2(i.vendorAdvances),
    stock: round2(i.stock),
    /** GST paid on purchases beyond what was charged on sales. */
    gstCredit: gst < 0 ? -gst : 0,
  };
  const liabilities = {
    payables: round2(i.payables),
    customerAdvances: round2(i.customerAdvances),
    /** GST charged on sales beyond what was paid on purchases. */
    gstPayable: gst > 0 ? gst : 0,
  };
  const totalAssets = round2(assets.cash + assets.receivables + assets.vendorAdvances + assets.stock + assets.gstCredit);
  const totalLiabilities = round2(liabilities.payables + liabilities.customerAdvances + liabilities.gstPayable);
  const capital = round2(totalAssets - totalLiabilities);
  const profitThisYear = round2(i.profitThisYear);
  return {
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    capital: {
      profitThisYear,
      /** Capital put in and profit of earlier years: whatever is left of the total. */
      earlier: round2(capital - profitThisYear),
      total: capital,
    },
  };
}

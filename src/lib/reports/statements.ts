// The arithmetic behind the Balance Sheet and the Cash Flow Statement.
//
// The app keeps no ledger, so both statements are built from the documents it
// does keep: invoices, payments, bills, expenses, returns, stock, and the
// Banking entries for money that is none of those (the owner's own money,
// loans, GST paid, equipment, other income). The owner's capital is the
// balancing figure: what the business has, less what it owes.

import { isIsoDate, presetRange } from "./period";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Money that moved in a stretch of time, by kind. All amounts are positive, except `drawer`. */
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
  /** Banking: the owner's own money put in. */
  ownerIn: number;
  /** Banking: the owner's own money taken out. */
  ownerOut: number;
  loansTaken: number;
  loansRepaid: number;
  /** GST paid to the government. */
  gstPaid: number;
  /** Equipment bought. */
  equipment: number;
  /** Income that is not a sale: interest, scrap, commission. */
  otherIncome: number;
  /**
   * Net change in the cash drawer: cash received less cash paid, less cash
   * put in the bank, plus cash drawn from it. The rest of the net movement
   * went through the bank.
   */
  drawer: number;
}

export const NO_MOVES: CashMoves = {
  cashSales: 0,
  received: 0,
  paidToVendors: 0,
  expenses: 0,
  refunds: 0,
  ownerIn: 0,
  ownerOut: 0,
  loansTaken: 0,
  loansRepaid: 0,
  gstPaid: 0,
  equipment: 0,
  otherIncome: 0,
  drawer: 0,
};

export function cashTotals(m: CashMoves) {
  const moneyIn = round2(m.cashSales + m.received + m.ownerIn + m.loansTaken + m.otherIncome);
  const moneyOut = round2(m.paidToVendors + m.expenses + m.refunds + m.ownerOut + m.loansRepaid + m.gstPaid + m.equipment);
  const net = round2(moneyIn - moneyOut);
  return { in: moneyIn, out: moneyOut, net, cash: round2(m.drawer), bank: round2(net - m.drawer) };
}

/** Cash in hand and money in the bank. */
export interface Money {
  cash: number;
  bank: number;
}

/** Where the money stands after `moves`, starting from `opening`. */
export function moneyAfter(opening: Money, moves: CashMoves): Money {
  const t = cashTotals(moves);
  return { cash: round2(opening.cash + t.cash), bank: round2(opening.bank + t.bank) };
}

/** Cash flow for a period, given the cash and bank balances at its start. */
export function buildCashFlow(moves: CashMoves, opening: Money) {
  const totals = cashTotals(moves);
  const closing = moneyAfter(opening, moves);
  return {
    ...moves,
    in: totals.in,
    out: totals.out,
    net: totals.net,
    opening: round2(opening.cash + opening.bank),
    closing: round2(closing.cash + closing.bank),
    closingCash: closing.cash,
    closingBank: closing.bank,
  };
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
  /** Cash in the shop: opening figure plus cash in, less cash out. */
  cashInHand: number;
  /** Money in the bank, counted the same way. */
  bank: number;
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
  /** Equipment bought, at what was paid for it. */
  equipment: number;
  /** Loans taken less loans repaid. */
  loans: number;
  /** GST charged on sales, less returns. */
  gstOutput: number;
  /** GST paid on purchases and expenses, less purchase returns. */
  gstInput: number;
  /** GST already paid to the government. */
  gstPaid: number;
  /** The owner's own money put in, less money taken out. */
  ownerMoney: number;
  /** Net profit from 1 April to the balance sheet date. */
  profitThisYear: number;
}

export function buildBalanceSheet(i: BalanceInputs) {
  const gst = round2(i.gstOutput - i.gstInput - i.gstPaid);
  const loans = round2(i.loans);
  const assets = {
    cashInHand: round2(i.cashInHand),
    bank: round2(i.bank),
    receivables: round2(i.receivables),
    vendorAdvances: round2(i.vendorAdvances),
    stock: round2(i.stock),
    equipment: round2(i.equipment),
    /** GST paid (on purchases or to the government) beyond what was charged on sales. */
    gstCredit: gst < 0 ? -gst : 0,
    /** More was repaid on loans than was recorded as taken. */
    loansOverpaid: loans < 0 ? -loans : 0,
  };
  const liabilities = {
    payables: round2(i.payables),
    customerAdvances: round2(i.customerAdvances),
    /** GST charged on sales that is still to be paid. */
    gstPayable: gst > 0 ? gst : 0,
    loans: loans > 0 ? loans : 0,
  };
  const totalAssets = round2(Object.values(assets).reduce((sum, n) => sum + n, 0));
  const totalLiabilities = round2(Object.values(liabilities).reduce((sum, n) => sum + n, 0));
  const capital = round2(totalAssets - totalLiabilities);
  const profitThisYear = round2(i.profitThisYear);
  const ownerMoney = round2(i.ownerMoney);
  return {
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    capital: {
      profitThisYear,
      ownerMoney,
      /** Capital at the start and profit of earlier years: whatever is left of the total. */
      earlier: round2(capital - profitThisYear - ownerMoney),
      total: capital,
    },
  };
}

import "server-only";

import { AGING_BUCKETS } from "@/lib/reports/aging";
import { csvFileName, money, type Cell } from "@/lib/reports/csv";
import type { Period } from "@/lib/reports/period";

import { arAging } from "./receivables";
import {
  customerBalances,
  expensesByCategory,
  gstSummary,
  LOW_STOCK_LIMIT,
  lowStock,
  profitAndLoss,
  readPeriod,
  salesByCustomer,
  salesByItem,
  salesSummary,
  vendorBalances,
} from "./reports";
import { balanceSheet, cashFlow, readAsOf } from "./statements";

type Params = Record<string, string | undefined>;

export interface ReportExport {
  /** File name of the download. */
  file: string;
  /** Title rows, a blank row, then the table. */
  rows: Cell[][];
}

/** More parts than the shop will ever sell in one period; the download is not cut short. */
const ALL_ITEMS = 100_000;

const periodText = (p: Period) => (p.from === p.to ? `On ${p.from}` : `From ${p.from} to ${p.to}`);
const periodFile = (report: string, p: Period) => csvFileName(report, p.from, "to", p.to);
const sheet = (title: string, caption: string, table: Cell[][]): Cell[][] => [[title], [caption], [], ...table];

/** Every report that can be downloaded, by the last part of its address. Each checks the user itself. */
const REPORTS: Record<string, (params: Params) => Promise<ReportExport>> = {
  "profit-and-loss": async (params) => {
    const period = await readPeriod(params);
    const pl = await profitAndLoss(period);
    return {
      file: periodFile("profit-and-loss", period),
      rows: sheet("Profit and Loss", periodText(period), [
        ["Particulars", "Amount"],
        ["Sales (less returns), before GST", money(pl.sales)],
        ["Cost of parts sold", money(-pl.costOfSales)],
        ["Gross profit", money(pl.gross)],
        [],
        ...pl.expenses.map((e): Cell[] => [`Expense: ${e.category}`, money(-e.amount)]),
        ...(pl.stockLost ? [["Stock lost or damaged", money(-pl.stockLost)] as Cell[]] : []),
        ...(pl.stockFound ? [["Stock found (count corrections)", money(pl.stockFound)] as Cell[]] : []),
        ["Total expenses", money(-(pl.expensesTotal + pl.stockLost - pl.stockFound))],
        [],
        ["Net profit", money(pl.net)],
      ]),
    };
  },

  "balance-sheet": async (params) => {
    const { asOf } = await readAsOf(params.date);
    const b = await balanceSheet(asOf);
    return {
      file: csvFileName("balance-sheet", asOf),
      rows: sheet("Balance Sheet", `As on ${asOf}`, [
        ["Section", "Particulars", "Amount"],
        ["Assets", "Cash and bank", b.assets.cash],
        ["Assets", "Customers owe you", b.assets.receivables],
        ["Assets", "Paid in advance to vendors", b.assets.vendorAdvances],
        ["Assets", "Stock in hand (purchase price, before GST)", b.assets.stock],
        ["Assets", "GST credit", b.assets.gstCredit],
        ["Assets", "Total assets", b.totalAssets],
        [],
        ["Liabilities", "You owe vendors", b.liabilities.payables],
        ["Liabilities", "Advances from customers", b.liabilities.customerAdvances],
        ["Liabilities", "GST to pay", b.liabilities.gstPayable],
        ["Liabilities", "Total liabilities", b.totalLiabilities],
        [],
        ["Capital", `Profit this financial year (from ${b.fyFrom})`, b.capital.profitThisYear],
        ["Capital", "Capital and earlier profit", b.capital.earlier],
        ["Capital", "Owner's capital", b.capital.total],
        [],
        ["", "Liabilities and capital", money(b.totalLiabilities + b.capital.total)],
      ]),
    };
  },

  "cash-flow": async (params) => {
    const period = await readPeriod(params);
    const cf = await cashFlow(period);
    return {
      file: periodFile("cash-flow", period),
      rows: sheet("Cash Flow Statement", periodText(period), [
        ["Section", "Particulars", "Amount"],
        ["Money in", "Cash sales", cf.cashSales],
        ["Money in", "Received from customers", cf.received],
        ["Money in", "Total money in", cf.in],
        [],
        ["Money out", "Paid to vendors", cf.paidToVendors],
        ["Money out", "Expenses (including GST)", cf.expenses],
        ["Money out", "Refunds to customers", cf.refunds],
        ["Money out", "Total money out", cf.out],
        [],
        ["Cash and bank", "Net cash flow", cf.net],
        ["Cash and bank", `Balance at start (${period.from})`, cf.opening],
        ["Cash and bank", `Balance at end (${period.to})`, cf.closing],
      ]),
    };
  },

  sales: async (params) => {
    const period = await readPeriod(params);
    const s = await salesSummary(period);
    return {
      file: periodFile("sales-summary", period),
      rows: sheet("Sales Summary", periodText(period), [
        ["Date", "Invoices", "Sales", "Returns", "Net sales"],
        ...s.days.map((d): Cell[] => [d.date, d.count, money(d.sales), money(d.returns), money(d.sales - d.returns)]),
        ["Total", s.sales.count, money(s.sales.total), money(s.returns.total), money(s.net.total)],
        [],
        ["Sales before GST", money(s.sales.taxable)],
        ["GST on sales", money(s.sales.gst)],
        ["Cash sales", money(s.sales.cash)],
        ["Credit sales", money(s.sales.credit)],
        ["Net sales before GST", money(s.net.taxable)],
      ]),
    };
  },

  "sales-by-customer": async (params) => {
    const period = await readPeriod(params);
    const r = await salesByCustomer(period);
    return {
      file: periodFile("sales-by-customer", period),
      rows: sheet("Sales by Customer", periodText(period), [
        ["Customer", "Invoices", "Sales", "Returns", "Net sales", "Net sales before GST"],
        ...r.items.map((c): Cell[] => [c.name, c.count, money(c.sales), money(c.returns), money(c.net), money(c.netTaxable)]),
        ["Total", null, r.totals.sales, r.totals.returns, r.totals.net],
      ]),
    };
  },

  "sales-by-item": async (params) => {
    const period = await readPeriod(params);
    const r = await salesByItem(period, ALL_ITEMS);
    return {
      file: periodFile("sales-by-item", period),
      rows: sheet("Sales by Item", `${periodText(period)} (amounts before GST, less returns)`, [
        ["Part no", "Item", "Unit", "Qty", "Sold", "Cost", "Profit"],
        ...r.items.map((i): Cell[] => [
          i.partNo,
          i.description,
          i.unit,
          i.qty,
          i.taxable,
          // No purchase price when sold: the cost is not known, so it is left empty.
          i.noCost > 0 && i.cost === 0 ? null : i.cost,
          i.noCost > 0 && i.cost === 0 ? null : i.profit,
        ]),
        ["Total", null, null, null, r.totals.taxable, r.totals.cost, money(r.totals.taxable - r.totals.cost - r.totals.noCost)],
      ]),
    };
  },

  gst: async (params) => {
    const period = await readPeriod(params);
    const g = await gstSummary(period);
    const line = (label: string, v: { taxable: number; cgst: number; sgst: number; igst: number }): Cell[] => [
      label,
      money(v.taxable),
      money(v.cgst),
      money(v.sgst),
      money(v.igst),
      money(v.cgst + v.sgst + v.igst),
    ];
    return {
      file: periodFile("gst-summary", period),
      rows: sheet("GST Summary", periodText(period), [
        ["Particulars", "Taxable value", "CGST", "SGST", "IGST", "Total GST"],
        line("Sales", g.sales),
        line("Less: sales returns", g.returns),
        line("GST on sales (output)", g.output),
        [],
        line("Purchase bills", g.inputFromBills),
        line("Expenses with GST", g.inputFromExpenses),
        line("Less: purchase returns", g.purchaseReturns),
        line("GST on purchases (input)", g.input),
        [],
        line("Output less input", g.payable),
        [],
        ["Sales by GST rate"],
        ["GST rate %", "Taxable value", "GST"],
        ...g.byRate.map((r): Cell[] => [r.rate, money(r.taxable), money(r.tax)]),
      ]),
    };
  },

  "customer-balances": async () => {
    const r = await customerBalances();
    return {
      file: csvFileName("customer-balances"),
      rows: sheet("Customer Balances", "As of now. A minus balance is an advance paid by the customer.", [
        ["Customer", "Mobile", "City", "Credit limit", "Balance"],
        ...r.items.map((c): Cell[] => [c.name, c.mobile, c.city, c.creditLimit, money(c.balance)]),
        [],
        ["Customers owe you", null, null, null, r.owed],
        ["Advances from customers", null, null, null, r.advance],
      ]),
    };
  },

  "ar-aging": async () => {
    const r = await arAging();
    return {
      file: csvFileName("ar-aging", r.today),
      rows: sheet("AR Aging Summary", `As on ${r.today}. Age is counted from the bill date.`, [
        ["Customer", "Mobile", "City", ...AGING_BUCKETS.map((b) => b.label), "Total", "Oldest bill (days)"],
        ...r.rows.map((c): Cell[] => [c.name, c.mobile, c.city, ...c.buckets, c.total, c.oldestDays]),
        ["Total", null, null, ...r.totals, r.total],
      ]),
    };
  },

  "vendor-balances": async () => {
    const r = await vendorBalances();
    return {
      file: csvFileName("vendor-balances"),
      rows: sheet("Vendor Balances", "As of now. A minus balance is an advance you paid.", [
        ["Vendor", "Mobile", "City", "Last paid on", "Balance"],
        ...r.items.map((v): Cell[] => [v.name, v.mobile, v.city, v.lastPaid, money(v.balance)]),
        [],
        ["You owe vendors", null, null, null, r.owed],
        ["Advances to vendors", null, null, null, r.advance],
      ]),
    };
  },

  "expenses-by-category": async (params) => {
    const period = await readPeriod(params);
    const r = await expensesByCategory(period);
    return {
      file: periodFile("expenses-by-category", period),
      rows: sheet("Expenses by Category", periodText(period), [
        ["Category", "Expenses", "Amount before GST", "GST"],
        ...r.items.map((e): Cell[] => [e.category, e.count, money(e.amount), money(e.gst)]),
        ["Total", null, r.total, r.gst],
      ]),
    };
  },

  "low-stock": async () => {
    const r = await lowStock(LOW_STOCK_LIMIT);
    return {
      file: csvFileName("low-stock"),
      rows: sheet("Low Stock", r.more ? `First ${LOW_STOCK_LIMIT} parts to reorder` : "Parts to reorder", [
        ["Part no", "Item", "Unit", "In stock", "Minimum"],
        ...r.items.map((p): Cell[] => [p.partNo, p.description, p.unit, p.stockQty, p.minStock]),
      ]),
    };
  },
};

/** The rows of one report, or null when there is no such report. */
export async function exportReport(report: string, params: Params): Promise<ReportExport | null> {
  if (!Object.hasOwn(REPORTS, report)) return null;
  return REPORTS[report](params);
}

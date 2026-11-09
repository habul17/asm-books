// Invoice maths, shared by the browser (live totals) and the server.
// The server always recalculates; it never trusts totals sent by the browser.

import { round2 } from "@/lib/pricing";

export type TaxType = "intra" | "inter";

export interface LineInput {
  qty: number;
  rate: number;
  discountPct: number;
  gstRate: number;
}

export interface LineAmounts {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface InvoiceTotals {
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
}

/** Indian financial year (April to March) of a YYYY-MM-DD date, e.g. "26-27". */
export function financialYear(date: string): string {
  const [y, m] = date.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  const yy = (n: number) => String(n % 100).padStart(2, "0");
  return `${yy(start)}-${yy(start + 1)}`;
}

/** INV + 26-27 + 7 → INV/26-27/0007 */
export const invoiceNumber = (prefix: string, fy: string, seq: number) =>
  `${prefix}/${fy}/${String(seq).padStart(4, "0")}`;

/** Same state (or unknown): CGST + SGST. Different states: IGST. */
export function taxTypeFor(sellerState: string | null, placeOfSupply: string | null): TaxType {
  return sellerState && placeOfSupply && sellerState !== placeOfSupply ? "inter" : "intra";
}

export function calcLine({ qty, rate, discountPct, gstRate }: LineInput, type: TaxType): LineAmounts {
  const taxable = round2(qty * rate * (1 - discountPct / 100));
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (type === "inter") igst = round2((taxable * gstRate) / 100);
  else {
    cgst = round2((taxable * gstRate) / 200);
    sgst = cgst;
  }
  return { taxable, cgst, sgst, igst, total: round2(taxable + cgst + sgst + igst) };
}

/**
 * Works out every line and the invoice totals. The grand total is rounded to
 * whole rupees unless `round` is false (some supplier bills keep the paise).
 */
export function calcInvoice<L extends LineInput>(lines: L[], type: TaxType, { round = true } = {}) {
  const out = lines.map((l) => ({ ...l, ...calcLine(l, type) }));
  const sum = (k: keyof LineAmounts) => round2(out.reduce((s, l) => s + l[k], 0));
  const exact = sum("total");
  const grandTotal = round ? Math.round(exact) : exact;
  const totals: InvoiceTotals = {
    taxableTotal: sum("taxable"),
    cgstTotal: sum("cgst"),
    sgstTotal: sum("sgst"),
    igstTotal: sum("igst"),
    roundOff: round2(grandTotal - exact),
    grandTotal,
  };
  return { lines: out, totals };
}

/** Tax per GST rate, as printed in the summary under an invoice. */
export function taxSummary(lines: (LineAmounts & { gstRate: number })[]) {
  const byRate = new Map<number, { gstRate: number; taxable: number; cgst: number; sgst: number; igst: number }>();
  for (const l of lines) {
    const row = byRate.get(l.gstRate) ?? { gstRate: l.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable = round2(row.taxable + l.taxable);
    row.cgst = round2(row.cgst + l.cgst);
    row.sgst = round2(row.sgst + l.sgst);
    row.igst = round2(row.igst + l.igst);
    byRate.set(l.gstRate, row);
  }
  return [...byRate.values()].sort((a, b) => a.gstRate - b.gstRate);
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const upTo99 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim());
const upTo999 = (n: number) => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? upTo99(r) : ""].filter(Boolean).join(" ");
};

function words(n: number): string {
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;
  if (crore) parts.push(`${crore > 999 ? words(crore) : upTo999(crore)} Crore`);
  if (lakh) parts.push(`${upTo99(lakh)} Lakh`);
  if (thousand) parts.push(`${upTo99(thousand)} Thousand`);
  if (n) parts.push(upTo999(n));
  return parts.join(" ");
}

/**
 * 123456 → "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only".
 * Rounds to whole rupees unless `paise` is set: 1500.5 → "Rupees One Thousand Five Hundred and Fifty Paise Only".
 */
export function amountInWords(amount: number, { paise = false } = {}): string {
  const total = Math.round(Math.abs(amount) * (paise ? 100 : 1));
  const rupees = paise ? Math.floor(total / 100) : total;
  const p = paise ? total % 100 : 0;
  if (rupees === 0 && p === 0) return "Rupees Zero Only";
  const r = rupees ? `Rupees ${words(rupees)}` : "Rupees Zero";
  return p ? `${r} and ${upTo99(p)} Paise Only` : `${r} Only`;
}

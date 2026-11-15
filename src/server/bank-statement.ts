import "server-only";

import { and, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { customers, expenses, invoices, moneyEntries, payments, vendorPayments, vendors } from "@/db/schema";
import { MONEY_KIND_INFO } from "@/lib/banking/entries";
import {
  checkStatement,
  MATCH_DAYS,
  matchLines,
  partyInNarration,
  prefillQuery,
  scannedStatementSchema,
  STATEMENT_INSTRUCTIONS,
  STATEMENT_JSON_SCHEMA,
  type BankRecord,
  type StatementLine,
} from "@/lib/banking/statement";
import { requireOwner } from "@/server/auth";
import { readDocument } from "@/server/bill-scan";
import { BillScanError, type BillFile } from "@/server/bill-scan/reader";

const STATEMENT_TASK = {
  noun: "bank statement",
  ask: "Read every transaction in this bank statement.",
  instructions: STATEMENT_INSTRUCTIONS,
  schema: STATEMENT_JSON_SCHEMA,
  // A month of entries is a long answer; give the main model time before the fallback.
  firstTryMs: 150_000,
};

export interface StatementRead {
  bankName: string | null;
  accountEnding: string | null;
  lines: StatementLine[];
  warnings: string[];
}

/** Reads a bank statement. Nothing is saved. */
export async function scanStatement(file: BillFile): Promise<StatementRead> {
  await requireOwner();
  const parsed = scannedStatementSchema.safeParse(await readDocument(file, STATEMENT_TASK));
  if (!parsed.success) throw new BillScanError("The statement could not be read. Try the PDF from your bank's website.");
  const { lines, warnings } = checkStatement(parsed.data);
  if (!lines.length) throw new BillScanError("No transactions were found in this statement.");
  return { bankName: parsed.data.bankName, accountEnding: parsed.data.accountEnding, lines, warnings };
}

const shift = (date: string, by: number) => new Date(Date.parse(date) + by * 86_400_000).toISOString().slice(0, 10);

/** Everything the app records as money through the bank between two dates. */
async function bankRecords(from: string, to: string): Promise<BankRecord[]> {
  const db = getDb();
  const [sales, received, paid, spent, entries] = await db.batch([
    db
      .select({ id: invoices.id, no: invoices.number, date: invoices.date, amount: invoices.grandTotal, who: invoices.customerName })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "final"),
          eq(invoices.paymentType, "cash"),
          ne(sql`coalesce(${invoices.cashMode}, 'cash')`, "cash"),
          gte(invoices.date, from),
          lte(invoices.date, to),
        ),
      ),
    db
      .select({ id: payments.id, no: payments.number, date: payments.date, amount: payments.amount, ref: payments.reference, who: customers.name })
      .from(payments)
      .leftJoin(customers, eq(customers.id, payments.customerId))
      .where(and(eq(payments.status, "final"), ne(payments.mode, "cash"), gte(payments.date, from), lte(payments.date, to))),
    db
      .select({ id: vendorPayments.id, no: vendorPayments.number, date: vendorPayments.date, amount: vendorPayments.amount, ref: vendorPayments.reference, who: vendors.name })
      .from(vendorPayments)
      .leftJoin(vendors, eq(vendors.id, vendorPayments.vendorId))
      .where(and(eq(vendorPayments.status, "final"), ne(vendorPayments.mode, "cash"), gte(vendorPayments.date, from), lte(vendorPayments.date, to))),
    db
      .select({ id: expenses.id, no: expenses.number, date: expenses.date, amount: expenses.amount, ref: expenses.reference, what: expenses.category })
      .from(expenses)
      .where(and(eq(expenses.status, "final"), ne(expenses.mode, "cash"), gte(expenses.date, from), lte(expenses.date, to))),
    db
      .select({ id: moneyEntries.id, kind: moneyEntries.kind, date: moneyEntries.date, amount: moneyEntries.amount, ref: moneyEntries.reference })
      .from(moneyEntries)
      .where(
        and(
          eq(moneyEntries.status, "final"),
          or(isNull(moneyEntries.mode), ne(moneyEntries.mode, "cash")),
          gte(moneyEntries.date, from),
          lte(moneyEntries.date, to),
        ),
      ),
  ]);
  return [
    ...sales.map((r) => ({ key: `inv-${r.id}`, flow: "in" as const, date: r.date, amount: r.amount, reference: null, label: `Bill ${r.no} · ${r.who}`, href: `/invoices/${r.id}` })),
    ...received.map((r) => ({ key: `pay-${r.id}`, flow: "in" as const, date: r.date, amount: r.amount, reference: r.ref, label: `Payment ${r.no} · ${r.who ?? ""}`, href: `/payments/${r.id}` })),
    ...paid.map((r) => ({ key: `vp-${r.id}`, flow: "out" as const, date: r.date, amount: r.amount, reference: r.ref, label: `Paid ${r.no} · ${r.who ?? ""}`, href: `/payments-made/${r.id}` })),
    ...spent.map((r) => ({ key: `exp-${r.id}`, flow: "out" as const, date: r.date, amount: r.amount, reference: r.ref, label: `Expense ${r.no} · ${r.what}`, href: `/expenses/${r.id}` })),
    ...entries.map((r) => {
      const info = MONEY_KIND_INFO[r.kind];
      // Cash paid into the bank adds to the bank; cash drawn out takes from it.
      const flow = info.flow === "transfer" ? (r.kind === "deposit" ? "in" : "out") : info.flow;
      return { key: `me-${r.id}`, flow: flow as "in" | "out", date: r.date, amount: r.amount, reference: r.ref, label: info.label, href: `/banking/${r.id}` };
    }),
  ];
}

export interface LineCheck {
  n: number;
  /** The app record this line is, when found. */
  found: { label: string; href: string } | null;
  /** Ready-filled forms to add a missing line, the most likely first. */
  add: { label: string; href: string }[];
}

const CHARGES = /\b(CHARGES?|CHGS?|FEE|SMS|AMC|GST ON|MIN BAL|PENAL)/i;
const CASH_DEPOSIT = /\b(CASH DEP|CASH DEPOSIT|BY CASH|CDM)\b/i;
const CASH_WITHDRAW = /\b(ATM|ATW|CASH WDL|CASH WITHDRAWAL|SELF)\b/i;

/** Which statement lines the app already has, and ready-filled forms for the rest. */
export async function checkStatementLines(lines: StatementLine[]): Promise<{ checks: LineCheck[]; inApp: number; missingIn: number; missingOut: number }> {
  await requireOwner();
  if (!lines.length) return { checks: [], inApp: 0, missingIn: 0, missingOut: 0 };
  const dates = lines.map((l) => l.date).sort();
  const db = getDb();
  const [records, people, suppliers] = await Promise.all([
    bankRecords(shift(dates[0], -MATCH_DAYS), shift(dates.at(-1)!, MATCH_DAYS)),
    db.select({ id: customers.id, name: customers.name, mobile: customers.mobile }).from(customers).where(eq(customers.active, true)),
    db.select({ id: vendors.id, name: vendors.name, mobile: vendors.mobile }).from(vendors).where(eq(vendors.active, true)),
  ]);
  const matched = matchLines(lines, records);
  const nameOf = (list: { id: number; name: string }[], id: number) => list.find((p) => p.id === id)?.name ?? "";

  let missingIn = 0;
  let missingOut = 0;
  const checks = lines.map((l): LineCheck => {
    const found = matched.get(l.n);
    if (found) return { n: l.n, found: { label: found.label, href: found.href }, add: [] };
    const add: LineCheck["add"] = [];
    if (l.flow === "in") {
      missingIn += l.amount;
      const customerId = partyInNarration(l.narration, people);
      if (CASH_DEPOSIT.test(l.narration)) add.push({ label: "Cash put in the bank", href: `/banking/new?${prefillQuery(l, { kind: "deposit" })}` });
      add.push(
        customerId
          ? { label: `Receive from ${nameOf(people, customerId)}`, href: `/payments/new?${prefillQuery(l, { customer: customerId })}` }
          : { label: "Receive payment", href: `/payments/new?${prefillQuery(l)}` },
      );
      add.push({ label: "Other money in", href: `/banking/new?${prefillQuery(l, { kind: "other_in" })}` });
    } else {
      missingOut += l.amount;
      const vendorId = partyInNarration(l.narration, suppliers);
      if (CASH_WITHDRAW.test(l.narration)) add.push({ label: "Cash taken from the bank", href: `/banking/new?${prefillQuery(l, { kind: "withdraw" })}` });
      if (CHARGES.test(l.narration)) add.push({ label: "Bank charges", href: `/expenses/new?${prefillQuery(l, { category: "Bank charges" })}` });
      add.push(
        vendorId
          ? { label: `Pay ${nameOf(suppliers, vendorId)}`, href: `/payments-made/new?${prefillQuery(l, { vendor: vendorId })}` }
          : { label: "Pay a vendor", href: `/payments-made/new?${prefillQuery(l)}` },
      );
      if (!CHARGES.test(l.narration)) add.push({ label: "Expense", href: `/expenses/new?${prefillQuery(l)}` });
      add.push({ label: "Other money out", href: `/banking/new?${prefillQuery(l, { kind: "owner_out" })}` });
    }
    return { n: l.n, found: null, add };
  });
  const round = (n: number) => Math.round(n * 100) / 100;
  return { checks, inApp: matched.size, missingIn: round(missingIn), missingOut: round(missingOut) };
}


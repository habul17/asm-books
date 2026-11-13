// Banking: money that is not a sale, a purchase or an expense.

import { z } from "zod";

import { moneyFields, PAYMENT_MODES, parseWith, trimmed, type PaymentMode } from "@/lib/payments/validation";

export const MONEY_KINDS = [
  "owner_in",
  "owner_out",
  "loan_in",
  "loan_out",
  "gst_paid",
  "asset_buy",
  "other_in",
  "deposit",
  "withdraw",
] as const;
export type MoneyKind = (typeof MONEY_KINDS)[number];

/** Whether an entry brings money in, sends it out, or only moves it between the cash drawer and the bank. */
export type MoneyFlow = "in" | "out" | "transfer";

export const MONEY_KIND_INFO: Record<MoneyKind, { label: string; hint: string; flow: MoneyFlow; party: string }> = {
  owner_in: {
    label: "Owner put money in",
    hint: "Your own money added to the business.",
    flow: "in",
    party: "",
  },
  owner_out: {
    label: "Owner took money out",
    hint: "Money taken for yourself or for home.",
    flow: "out",
    party: "",
  },
  loan_in: {
    label: "Loan received",
    hint: "Money borrowed from a bank or a person.",
    flow: "in",
    party: "Borrowed from",
  },
  loan_out: {
    label: "Loan repaid",
    hint: "Money paid back on a loan. Enter interest as an expense instead.",
    flow: "out",
    party: "Paid back to",
  },
  gst_paid: {
    label: "GST paid to government",
    hint: "GST paid with your return. It lowers “GST to pay”.",
    flow: "out",
    party: "",
  },
  asset_buy: {
    label: "Equipment bought",
    hint: "Computer, furniture, vehicle, tools: things the shop keeps and uses.",
    flow: "out",
    party: "Bought from",
  },
  other_in: {
    label: "Other income",
    hint: "Bank interest, scrap sold, commission. It adds to profit.",
    flow: "in",
    party: "Received from",
  },
  deposit: {
    label: "Cash put in the bank",
    hint: "Cash from the shop paid into the bank account.",
    flow: "transfer",
    party: "",
  },
  withdraw: {
    label: "Cash taken from the bank",
    hint: "Cash drawn from the bank account for the shop.",
    flow: "transfer",
    party: "",
  },
};

export const isTransfer = (kind: MoneyKind) => MONEY_KIND_INFO[kind].flow === "transfer";

const entrySchema = z
  .object({
    kind: z.enum(MONEY_KINDS, { error: "Choose what the money was for" }),
    party: trimmed(100, "Name"),
    ...moneyFields("moved"),
    /** Moving cash to or from the bank has no mode: it is cash on one side and bank on the other. */
    mode: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(PAYMENT_MODES).nullable()),
  })
  .transform((v) => (isTransfer(v.kind) ? { ...v, mode: null, party: "" } : v))
  .refine((v) => isTransfer(v.kind) || v.mode != null, "Choose how it was paid");

export interface MoneyEntryInput {
  kind: MoneyKind;
  party: string;
  date: string;
  amount: number;
  mode: PaymentMode | null;
  reference: string;
  notes: string;
}

export const parseMoneyEntry = (form: FormData | Record<string, unknown>) =>
  parseWith<MoneyEntryInput>(entrySchema as z.ZodType<MoneyEntryInput>, form);

export interface EntryTotals {
  kind: MoneyKind;
  /** All final entries of this kind. */
  amount: number;
  /** The part paid or received in cash. */
  cash: number;
}

export type KindTotals = Record<MoneyKind, { amount: number; cash: number }>;

/** Totals per kind with a zero for every kind that has no entries. */
export function kindTotals(rows: EntryTotals[]): KindTotals {
  const out = Object.fromEntries(MONEY_KINDS.map((k) => [k, { amount: 0, cash: 0 }])) as KindTotals;
  for (const r of rows) out[r.kind] = { amount: r.amount, cash: r.cash };
  return out;
}

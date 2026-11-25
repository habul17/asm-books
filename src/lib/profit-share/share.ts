// Profit from money received is shared half and half between the two partners.
// The owner can set expenses that come off a partner's half: every month (from a
// start date, until an end date or for good) or once (on one date).

import { z } from "zod";

import { formatDate } from "@/lib/format";
import { PAYMENT_MAX } from "@/lib/payments/validation";

export const PARTNERS = ["ashi", "dad"] as const;
export type Partner = (typeof PARTNERS)[number];
export const PARTNER_NAMES: Record<Partner, string> = { ashi: "Ashi", dad: "Dad" };

export const REPEATS = ["monthly", "once"] as const;
export type Repeat = (typeof REPEATS)[number];
export const REPEAT_LABELS: Record<Repeat, string> = { monthly: "Every month", once: "Once" };

/** More than any shop needs; it only keeps the saved list small. */
export const MAX_SHARE_EXPENSES = 50;
export const MAX_NAME = 60;

export interface ShareExpenseInput {
  /** What it is for, e.g. "Shop rent". */
  name: string;
  /** Taken from each partner's half every time the expense comes off. */
  ashi: number;
  dad: number;
  repeat: Repeat;
  /** The first (or only) day it comes off. */
  start: string;
  /** Every month only: the last day it can come off. Null keeps it going. */
  end: string | null;
}

export interface ShareExpense extends ShareExpenseInput {
  id: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
const monthIndex = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return y * 12 + (m - 1);
};
const firstOfMonth = (i: number) => `${Math.floor(i / 12)}-${pad((i % 12) + 1)}-01`;

/**
 * The days an expense comes off between `from` and `to` (inclusive ISO dates).
 * Once: on its date. Every month: on the start date, then on the 1st of each
 * later month, up to the end date.
 */
export function expenseDates(e: Pick<ShareExpense, "repeat" | "start" | "end">, from: string, to: string): string[] {
  if (e.repeat === "monthly" && e.end != null && e.end < e.start) return [];
  const out: string[] = [];
  if (e.start >= from && e.start <= to) out.push(e.start);
  if (e.repeat === "once") return out;
  const last = Math.min(monthIndex(to), e.end == null ? Infinity : monthIndex(e.end));
  for (let i = Math.max(monthIndex(e.start) + 1, monthIndex(from)); i <= last; i++) {
    const day = firstOfMonth(i);
    if (day >= from && day <= to && (e.end == null || day <= e.end)) out.push(day);
  }
  return out;
}

export interface PartnerShare {
  /** Half of the profit. */
  share: number;
  /** The partner's expenses that came off in the period. */
  expenses: number;
  /** What is left for the partner: the half less the expenses. */
  final: number;
}

export interface ProfitShare extends Record<Partner, PartnerShare> {
  /** How many times each expense came off in the period, by expense id. Expenses that did not are left out. */
  counted: Record<string, number>;
}

/** Splits the profit half and half, then takes off each partner's expenses that fall in the period. */
export function shareProfit(profit: number, expenses: ShareExpense[], from: string, to: string): ProfitShare {
  const half = round2(profit / 2);
  const shares: Record<Partner, number> = { ashi: half, dad: round2(profit - half) };
  const spent: Record<Partner, number> = { ashi: 0, dad: 0 };
  const counted: Record<string, number> = {};
  for (const e of expenses) {
    const times = expenseDates(e, from, to).length;
    if (times === 0) continue;
    counted[e.id] = times;
    for (const p of PARTNERS) spent[p] += e[p] * times;
  }
  const partner = (p: Partner): PartnerShare => ({
    share: shares[p],
    expenses: round2(spent[p]),
    final: round2(shares[p] - spent[p]),
  });
  return { ashi: partner("ashi"), dad: partner("dad"), counted };
}

/** "Every month from 01-11-2026 to 31-01-2027", "Once, on 05-11-2026": for lists. */
export function scheduleLabel(e: Pick<ShareExpense, "repeat" | "start" | "end">): string {
  if (e.repeat === "once") return `Once, on ${formatDate(e.start)}`;
  return `Every month from ${formatDate(e.start)}${e.end ? ` to ${formatDate(e.end)}` : ""}`;
}

/** Exactly which days the expense comes off, in a sentence: for the form. */
export function scheduleSentence(e: Pick<ShareExpense, "repeat" | "start" | "end">): string {
  if (e.repeat === "once") return `Comes off once, on ${formatDate(e.start)}.`;
  const until = e.end ? ` until ${formatDate(e.end)}` : "";
  if (e.start.endsWith("-01")) return `Comes off on the 1st of every month, from ${formatDate(e.start)}${until}.`;
  return `Comes off on ${formatDate(e.start)}, then on the 1st of every month${until}.`;
}

/** True when a monthly expense has passed its end date, or a one-time one its date. */
export function hasEnded(e: Pick<ShareExpense, "repeat" | "start" | "end">, today: string): boolean {
  return e.repeat === "once" ? e.start < today : e.end != null && e.end < today;
}

const amount = (who: string) =>
  z.preprocess(
    (v) => {
      if (v == null) return 0;
      if (typeof v !== "string") return v;
      const clean = v.replace(/[,\s₹]/g, "");
      return clean === "" ? 0 : Number(clean);
    },
    z
      .number({ error: `Enter the amount for ${who}` })
      .min(0, `The amount for ${who} cannot be less than 0`)
      .max(PAYMENT_MAX, `The amount for ${who} is too large; please check it`)
      .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, `The amount for ${who} can have at most 2 decimals`),
  );

const isoDate = (error: string) => z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.iso.date(error));

const inputSchema = z
  .object({
    name: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""),
      z
        .string()
        .min(1, "Write what the expense is for")
        .max(MAX_NAME, `What it is for can be at most ${MAX_NAME} characters`),
    ),
    ashi: amount(PARTNER_NAMES.ashi),
    dad: amount(PARTNER_NAMES.dad),
    repeat: z.enum(REPEATS, { error: "Choose how often it comes off" }),
    start: isoDate("Enter a valid start date"),
    end: z.preprocess(
      (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
      z.iso.date("Enter a valid end date").nullable(),
    ),
  })
  // A one-time expense has a single date.
  .transform((v) => (v.repeat === "once" ? { ...v, end: null } : v))
  .refine((v) => v.ashi > 0 || v.dad > 0, `Enter an amount for ${PARTNER_NAMES.ashi}, ${PARTNER_NAMES.dad} or both`)
  .refine((v) => v.end == null || v.end >= v.start, "The end date must be on or after the start date");

export type Parsed<T> = { value: T; error?: never } | { error: string; value?: never };

/** Reads the expense form. */
export function parseShareExpense(form: FormData | Record<string, unknown>): Parsed<ShareExpenseInput> {
  const raw = form instanceof FormData ? Object.fromEntries(form) : form;
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the details." };
  const v = parsed.data;
  return { value: { name: v.name, ashi: round2(v.ashi), dad: round2(v.dad), repeat: v.repeat, start: v.start, end: v.end } };
}

const storedSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(MAX_NAME),
  ashi: z.number().min(0).max(PAYMENT_MAX),
  dad: z.number().min(0).max(PAYMENT_MAX),
  repeat: z.enum(REPEATS),
  start: z.iso.date(),
  end: z.iso.date().nullable(),
});

/** The saved expenses, newest start date first. Anything malformed is skipped. */
export function readShareExpenses(value: unknown): ShareExpense[] {
  if (!Array.isArray(value)) return [];
  const out: ShareExpense[] = [];
  for (const item of value) {
    const parsed = storedSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out.sort((a, b) => b.start.localeCompare(a.start) || a.name.localeCompare(b.name));
}

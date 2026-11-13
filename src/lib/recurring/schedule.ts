// Recurring invoices: how often, and when the next one is due.

import { z } from "zod";

import { isIsoDate } from "@/lib/reports/period";

export const FREQUENCIES = ["weekly", "monthly", "quarterly", "half_yearly", "yearly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Every week",
  monthly: "Every month",
  quarterly: "Every 3 months",
  half_yearly: "Every 6 months",
  yearly: "Every year",
};

const MONTHS: Record<Exclude<Frequency, "weekly">, number> = { monthly: 1, quarterly: 3, half_yearly: 6, yearly: 12 };

const pad = (n: number) => String(n).padStart(2, "0");
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based

/** The day of the month a date falls on. */
export const dayOf = (date: string) => Number(date.slice(8, 10));

/**
 * The due date after `date`. Monthly and longer steps land on `anchorDay`,
 * or on the last day of a shorter month, so a bill on the 31st does not
 * drift to the 28th for good after February.
 */
export function nextOccurrence(date: string, frequency: Frequency, anchorDay: number): string {
  if (frequency === "weekly") {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  const [y, m] = date.split("-").map(Number);
  const months = y * 12 + (m - 1) + MONTHS[frequency];
  const ny = Math.floor(months / 12);
  const nm = (months % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(anchorDay, monthEnd(ny, nm)))}`;
}

/** The first due date offered for an invoice dated `invoiceDate`: one step later, but never before today. */
export function suggestedStart(invoiceDate: string, frequency: Frequency, today: string): string {
  let next = nextOccurrence(invoiceDate, frequency, dayOf(invoiceDate));
  // An old invoice: step forward until the date is not in the past.
  for (let i = 0; i < 1000 && next < today; i++) next = nextOccurrence(next, frequency, dayOf(invoiceDate));
  return next;
}

export interface RecurringState {
  nextDate: string;
  endDate: string | null;
  active: boolean;
}

/** True when an invoice should be made now. */
export const isDue = (r: RecurringState, today: string) =>
  r.active && r.nextDate <= today && (r.endDate == null || r.nextDate <= r.endDate);

/** Where a recurring invoice stands after one invoice is made or skipped: the next date, or stopped past its end. */
export function advance(r: { nextDate: string; endDate: string | null; frequency: Frequency; anchorDay: number }) {
  const nextDate = nextOccurrence(r.nextDate, r.frequency, r.anchorDay);
  return { nextDate, active: r.endDate == null || nextDate <= r.endDate };
}

const isoDate = (message: string) => z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().refine(isIsoDate, message));

const recurringSchema = z
  .object({
    invoiceId: z.preprocess((v) => Number(v), z.number({ error: "Invoice not found" }).int().positive("Invoice not found")),
    frequency: z.enum(FREQUENCIES, { error: "Choose how often to repeat" }),
    nextDate: isoDate("Enter the date of the next invoice"),
    endDate: z.preprocess(
      (v) => (typeof v === "string" && v.trim() !== "" ? v : null),
      z.string().refine(isIsoDate, "Enter a valid end date").nullable(),
    ),
    notes: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(500, "Notes can be at most 500 characters")),
  })
  .refine((v) => v.endDate == null || v.endDate >= v.nextDate, "The end date cannot be before the next invoice date");

export type RecurringInput = z.infer<typeof recurringSchema>;

export function parseRecurringInput(
  form: FormData | Record<string, unknown>,
): { value: RecurringInput; error?: never } | { error: string; value?: never } {
  const parsed = recurringSchema.safeParse(form instanceof FormData ? Object.fromEntries(form) : form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the details." };
  return { value: parsed.data };
}

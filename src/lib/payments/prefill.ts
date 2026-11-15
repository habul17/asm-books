// Values passed in a link to fill a money form, e.g. from a bank statement line.
// Links can be edited by hand, so every value is checked and anything odd is dropped.

import { PAYMENT_MAX, PAYMENT_MODES, type PaymentMode } from "./validation";

export interface MoneyPrefill {
  amount: number | null;
  date: string | null;
  mode: PaymentMode | null;
  reference: string;
  notes: string;
  category: string;
}

type Query = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

export function moneyPrefill(q: Query, today: string): MoneyPrefill {
  const amount = Number(one(q.amount));
  const date = one(q.date);
  const mode = one(q.mode);
  return {
    amount: Number.isFinite(amount) && amount > 0 && amount <= PAYMENT_MAX ? Math.round(amount * 100) / 100 : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && date <= today ? date : null,
    mode: PAYMENT_MODES.find((m) => m === mode) ?? null,
    reference: one(q.ref).slice(0, 100),
    notes: one(q.notes).slice(0, 1000),
    category: one(q.category).slice(0, 60),
  };
}

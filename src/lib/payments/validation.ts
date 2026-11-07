// Checks a "payment received" form before it reaches the database.

import { z } from "zod";

export const PAYMENT_MODES = ["cash", "upi", "bank", "cheque", "card"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  bank: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
};

/** Largest single payment accepted; far above any real one, it only stops typing mistakes. */
export const PAYMENT_MAX = 100_000_000;

const trimmed = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().max(max, `${label} can be at most ${max} characters`),
  );

const paymentSchema = z.object({
  customerId: z.preprocess(
    (v) => (v === "" || v == null ? Number.NaN : Number(v)),
    z.number({ error: "Choose a customer" }).int("Choose a customer").positive("Choose a customer"),
  ),
  date: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z.iso.date("Enter a valid date"),
  ),
  amount: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[,\s₹]/g, "") || Number.NaN) : v),
    z
      .number({ error: "Enter the amount received" })
      .positive("Amount must be more than 0")
      .max(PAYMENT_MAX, "Amount is too large; please check it")
      .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "Amount can have at most 2 decimals"),
  ),
  mode: z.enum(PAYMENT_MODES, { error: "Choose how it was paid" }),
  reference: trimmed(100, "Reference"),
  notes: trimmed(1000, "Notes"),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export function parsePaymentInput(
  form: FormData | Record<string, unknown>,
): { value: PaymentInput; error?: never } | { error: string; value?: never } {
  const raw = form instanceof FormData ? Object.fromEntries(form) : form;
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the details." };
  return { value: { ...parsed.data, amount: Math.round(parsed.data.amount * 100) / 100 } };
}

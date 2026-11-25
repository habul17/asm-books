import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { readShareExpenses, shareProfit, type ShareExpense } from "@/lib/profit-share/share";
import type { Period } from "@/lib/reports/period";

import { requireOwner } from "./auth";
import { profitReceived } from "./profit-received";

/** Where the partners' expenses are kept, as a list in the settings table. */
export const SHARE_EXPENSES_KEY = "profit_share_expenses";

/** The expenses set for the partners. No auth check: callers must check for the owner. */
export async function loadShareExpenses(): Promise<ShareExpense[]> {
  const [row] = await getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SHARE_EXPENSES_KEY));
  return readShareExpenses(row?.value);
}

/**
 * The money received in a period, the profit in it, and each partner's half
 * less their expenses: in total and month by month. Owner only.
 */
export async function getProfitShare(period: Period) {
  await requireOwner();
  const [received, expenses] = await Promise.all([profitReceived(period), loadShareExpenses()]);
  return {
    ...received.total,
    ...shareProfit(received.total.profit, expenses, period.from, period.to),
    months: received.months.map((m) => ({ ...m, ...shareProfit(m.profit, expenses, m.from, m.to) })),
    expenses,
  };
}

export type ProfitShareData = Awaited<ReturnType<typeof getProfitShare>>;

/** One expense, for its edit screen; null when there is none with this id. Owner only. */
export async function getShareExpense(id: string): Promise<ShareExpense | null> {
  await requireOwner();
  return (await loadShareExpenses()).find((e) => e.id === id) ?? null;
}

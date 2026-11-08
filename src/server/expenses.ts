import "server-only";

import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { expenses, users } from "@/db/schema";
import { requireUser } from "@/server/auth";

export const EXPENSE_LIMIT = 100;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type ExpenseStatusFilter = "all" | "final" | "cancelled";

export interface ExpenseFilters {
  query: string;
  status: ExpenseStatusFilter;
}

/** Every word must appear in the expense number, category, paid to, reference or notes. */
export async function searchExpenses(filters: ExpenseFilters, limit = EXPENSE_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [filters.status === "all" ? undefined : eq(expenses.status, filters.status)];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(
        ilike(expenses.number, like),
        ilike(expenses.category, like),
        ilike(expenses.paidTo, like),
        ilike(expenses.reference, like),
        ilike(expenses.notes, like),
      ),
    );
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        total: sql<number>`coalesce(sum(${expenses.amount}) FILTER (WHERE ${expenses.status} = 'final'), 0)`.mapWith(Number),
      })
      .from(expenses)
      .where(where),
    db
      .select({
        id: expenses.id,
        number: expenses.number,
        date: expenses.date,
        category: expenses.category,
        paidTo: expenses.paidTo,
        amount: expenses.amount,
        mode: expenses.mode,
        status: expenses.status,
      })
      .from(expenses)
      .where(where)
      .orderBy(desc(expenses.date), desc(expenses.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, total: summary[0]?.total ?? 0, items };
}

export type ExpenseListItem = Awaited<ReturnType<typeof searchExpenses>>["items"][number];

/** One expense with who recorded it. */
export async function getExpense(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb()
    .select({
      id: expenses.id,
      number: expenses.number,
      date: expenses.date,
      category: expenses.category,
      paidTo: expenses.paidTo,
      amount: expenses.amount,
      mode: expenses.mode,
      reference: expenses.reference,
      notes: expenses.notes,
      status: expenses.status,
      cancelReason: expenses.cancelReason,
      createdByName: users.name,
    })
    .from(expenses)
    .leftJoin(users, eq(users.id, expenses.createdBy))
    .where(eq(expenses.id, id));
  return row ?? null;
}

export type ExpenseDetail = NonNullable<Awaited<ReturnType<typeof getExpense>>>;

/** Categories used before, most used first, merged after the suggested ones in the form. */
export async function usedExpenseCategories() {
  await requireUser();
  const rows = await getDb()
    .select({ category: sql<string>`min(${expenses.category})` })
    .from(expenses)
    .groupBy(sql`lower(${expenses.category})`)
    .orderBy(desc(sql`count(*)`), asc(sql`min(${expenses.category})`))
    .limit(50);
  return rows.map((r) => r.category);
}

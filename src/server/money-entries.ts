import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { moneyEntries, users } from "@/db/schema";
import { MONEY_KIND_INFO, MONEY_KINDS, type MoneyEntryInput } from "@/lib/banking/entries";
import { requireOwner } from "@/server/auth";

export const MONEY_ENTRY_LIMIT = 100;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type MoneyEntryStatusFilter = "all" | "final" | "cancelled";

export interface MoneyEntryFilters {
  query: string;
  status: MoneyEntryStatusFilter;
}

/** Banking entries, newest first. Every word must appear in the kind, name, reference or notes. Owner only. */
export async function searchMoneyEntries(filters: MoneyEntryFilters, limit = MONEY_ENTRY_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  await requireOwner();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [filters.status === "all" ? undefined : eq(moneyEntries.status, filters.status)];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    // The kind is stored as a code, so its label is matched here.
    const kinds = MONEY_KINDS.filter((k) => MONEY_KIND_INFO[k].label.toLowerCase().includes(word.toLowerCase()));
    conditions.push(
      or(
        ilike(moneyEntries.party, like),
        ilike(moneyEntries.reference, like),
        ilike(moneyEntries.notes, like),
        ...kinds.map((k) => eq(moneyEntries.kind, k)),
      ),
    );
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(moneyEntries).where(where),
    db
      .select({
        id: moneyEntries.id,
        date: moneyEntries.date,
        kind: moneyEntries.kind,
        amount: moneyEntries.amount,
        mode: moneyEntries.mode,
        party: moneyEntries.party,
        status: moneyEntries.status,
      })
      .from(moneyEntries)
      .where(where)
      .orderBy(desc(moneyEntries.date), desc(moneyEntries.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, items };
}

export type MoneyEntryListItem = Awaited<ReturnType<typeof searchMoneyEntries>>["items"][number];

/** One entry with who recorded it. Owner only. */
export async function getMoneyEntry(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireOwner();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb()
    .select({
      id: moneyEntries.id,
      date: moneyEntries.date,
      kind: moneyEntries.kind,
      amount: moneyEntries.amount,
      mode: moneyEntries.mode,
      party: moneyEntries.party,
      reference: moneyEntries.reference,
      notes: moneyEntries.notes,
      status: moneyEntries.status,
      cancelReason: moneyEntries.cancelReason,
      createdByName: users.name,
    })
    .from(moneyEntries)
    .leftJoin(users, eq(users.id, moneyEntries.createdBy))
    .where(eq(moneyEntries.id, id));
  return row ?? null;
}

/** A problem with what the user entered; the message is safe to show. */
export class MoneyEntryError extends Error {}

/** Saves a new entry. No auth check: the action has checked the owner. */
export async function createMoneyEntry(input: MoneyEntryInput, userId: number): Promise<number> {
  const [{ id }] = await getDb()
    .insert(moneyEntries)
    .values({
      date: input.date,
      kind: input.kind,
      amount: input.amount,
      mode: input.mode,
      party: input.party || null,
      reference: input.reference || null,
      notes: input.notes || null,
      createdBy: userId,
    })
    .returning({ id: moneyEntries.id });
  return id;
}

/** Marks an entry as cancelled, so it no longer counts. No auth check: the action has checked the owner. */
export async function cancelMoneyEntry(id: number, reason: string): Promise<void> {
  const done = await getDb()
    .update(moneyEntries)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
    .where(and(eq(moneyEntries.id, id), eq(moneyEntries.status, "final")))
    .returning({ id: moneyEntries.id });
  if (done.length === 0) throw new MoneyEntryError("Entry not found, or it is already cancelled.");
}

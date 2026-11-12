import "server-only";

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { bills, documentFiles, documents, expenses, users } from "@/db/schema";
import { DOCUMENT_STORAGE_LIMIT, type DocumentFolder } from "@/lib/documents/documents";
import { isOwner, requireUser, type CurrentUser } from "@/server/auth";

export const DOCUMENT_LIMIT = 200;
const MAX_WORDS = 8;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface DocumentFilters {
  query: string;
  folder: DocumentFolder | "all";
  billId?: number | null;
  expenseId?: number | null;
}

/** Staff never see documents marked "owner only". */
export const visibleTo = (user: CurrentUser): SQL | undefined =>
  isOwner(user) ? undefined : eq(documents.ownerOnly, false);

const listColumns = {
  id: documents.id,
  title: documents.title,
  folder: documents.folder,
  mimeType: documents.mimeType,
  size: documents.size,
  docDate: documents.docDate,
  notes: documents.notes,
  ownerOnly: documents.ownerOnly,
  billId: documents.billId,
  billNo: bills.billNo,
  expenseId: documents.expenseId,
  expenseNumber: expenses.number,
  uploadedByName: users.name,
  createdAt: documents.createdAt,
};

/** Every word must appear in the name or the notes. Newest first. */
export async function searchDocuments(filters: DocumentFilters, limit = DOCUMENT_LIMIT) {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  const words = filters.query.trim().slice(0, 200).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const conditions: (SQL | undefined)[] = [
    visibleTo(user),
    filters.folder === "all" ? undefined : eq(documents.folder, filters.folder),
    filters.billId ? eq(documents.billId, filters.billId) : undefined,
    filters.expenseId ? eq(documents.expenseId, filters.expenseId) : undefined,
  ];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(or(ilike(documents.title, like), ilike(documents.notes, like)));
  }
  const where = and(...conditions);
  const db = getDb();
  const [summary, items] = await db.batch([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(documents).where(where),
    db
      .select(listColumns)
      .from(documents)
      .leftJoin(bills, eq(bills.id, documents.billId))
      .leftJoin(expenses, eq(expenses.id, documents.expenseId))
      .leftJoin(users, eq(users.id, documents.uploadedBy))
      .where(where)
      .orderBy(desc(documents.createdAt), desc(documents.id))
      .limit(Math.min(Math.max(limit, 1), 500)),
  ]);
  return { count: summary[0]?.count ?? 0, items };
}

export type DocumentListItem = Awaited<ReturnType<typeof searchDocuments>>["items"][number];

/** One document's details (not its bytes), or null when it is missing or hidden from this user. */
export async function getDocument(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb()
    .select(listColumns)
    .from(documents)
    .leftJoin(bills, eq(bills.id, documents.billId))
    .leftJoin(expenses, eq(expenses.id, documents.expenseId))
    .leftJoin(users, eq(users.id, documents.uploadedBy))
    .where(and(eq(documents.id, id), visibleTo(user)));
  return row ?? null;
}

/** The file itself, for the signed-in `user`. Null when it is missing or hidden from them. */
export async function readDocumentFile(id: number, user: CurrentUser) {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb()
    .select({
      title: documents.title,
      mimeType: documents.mimeType,
      base64: sql<string>`encode(${documentFiles.data}, 'base64')`,
    })
    .from(documents)
    .innerJoin(documentFiles, eq(documentFiles.documentId, documents.id))
    .where(and(eq(documents.id, id), visibleTo(user)));
  if (!row) return null;
  return { title: row.title, mimeType: row.mimeType, bytes: Buffer.from(row.base64, "base64") };
}

/** How much room all the files take, counting the ones this user cannot see. */
export async function documentStorage() {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  const [row] = await getDb()
    .select({ used: sql<number>`coalesce(sum(${documents.size}), 0)`.mapWith(Number) })
    .from(documents);
  return { used: row?.used ?? 0, limit: DOCUMENT_STORAGE_LIMIT };
}

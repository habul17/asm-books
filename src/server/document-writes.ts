import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { withTransaction } from "@/db";
import { bills, documentFiles, documents, expenses } from "@/db/schema";
import {
  DOCUMENT_STORAGE_LIMIT,
  formatBytes,
  type DocumentDetails,
  type DocumentFolder,
  type DocumentLink,
  type DocumentMimeType,
} from "@/lib/documents/documents";
import { isOwner, type CurrentUser } from "@/server/auth";

import { visibleTo } from "./documents";

/** A problem with what the user sent; the message is safe to show. */
export class DocumentInputError extends Error {}

/** Key for the lock that lets one upload at a time check the storage limit. */
const DOCUMENT_STORAGE_LOCK = 72_810_010;

export interface NewDocument {
  title: string;
  folder: DocumentFolder;
  ownerOnly: boolean;
  link: DocumentLink;
  mimeType: DocumentMimeType;
  bytes: Buffer;
}

/** Stores an uploaded file. The caller has already checked its type and size. */
export async function createDocument(input: NewDocument, user: CurrentUser): Promise<number> {
  return withTransaction(async (tx) => {
    // One upload at a time, so two together cannot both slip under the limit.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${DOCUMENT_STORAGE_LOCK})`);
    const [{ used }] = await tx
      .select({ used: sql<number>`coalesce(sum(${documents.size}), 0)`.mapWith(Number) })
      .from(documents);
    if (used + input.bytes.length > DOCUMENT_STORAGE_LIMIT) {
      throw new DocumentInputError(
        `Documents are full (${formatBytes(DOCUMENT_STORAGE_LIMIT)}). Delete files you no longer need, then try again.`,
      );
    }

    let billId: number | null = null;
    let expenseId: number | null = null;
    if (input.link && "billId" in input.link) {
      const [bill] = await tx.select({ id: bills.id }).from(bills).where(eq(bills.id, input.link.billId));
      if (!bill) throw new DocumentInputError("Bill not found.");
      billId = bill.id;
    } else if (input.link) {
      const [expense] = await tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.id, input.link.expenseId));
      if (!expense) throw new DocumentInputError("Expense not found.");
      expenseId = expense.id;
    }

    const [{ id }] = await tx
      .insert(documents)
      .values({
        title: input.title,
        folder: input.folder,
        mimeType: input.mimeType,
        size: input.bytes.length,
        // Only the owner can hide a document from staff.
        ownerOnly: input.ownerOnly && isOwner(user),
        billId,
        expenseId,
        uploadedBy: user.id,
      })
      .returning({ id: documents.id });
    await tx
      .insert(documentFiles)
      .values({ documentId: id, data: sql`decode(${input.bytes.toString("base64")}, 'base64')` });
    return id;
  });
}

/** Changes a document's name, folder, date and notes. Staff cannot change who may see it. */
export async function updateDocument(id: number, details: DocumentDetails, user: CurrentUser): Promise<void> {
  await withTransaction(async (tx) => {
    const [doc] = await tx
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, id), visibleTo(user)))
      .for("update");
    if (!doc) throw new DocumentInputError("Document not found.");
    await tx
      .update(documents)
      .set({
        title: details.title,
        folder: details.folder,
        docDate: details.docDate,
        notes: details.notes || null,
        ...(isOwner(user) ? { ownerOnly: details.ownerOnly } : {}),
      })
      .where(eq(documents.id, id));
  });
}

/** Removes a document and its file for good. */
export async function deleteDocument(id: number): Promise<void> {
  await withTransaction(async (tx) => {
    const deleted = await tx.delete(documents).where(eq(documents.id, id)).returning({ id: documents.id });
    if (!deleted.length) throw new DocumentInputError("Document not found.");
  });
}

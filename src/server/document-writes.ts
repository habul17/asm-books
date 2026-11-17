import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { withTransaction } from "@/db";
import {
  bills,
  documentFiles,
  documents,
  expenses,
  invoices,
  payments,
  purchaseOrders,
  purchaseReturns,
  vendorPayments,
} from "@/db/schema";
import {
  DOCUMENT_STORAGE_LIMIT,
  formatBytes,
  type DocumentDetails,
  type DocumentFolder,
  linkParts,
  type DocumentLink,
  type DocumentLinkKey,
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
  /** A scan kept until the form it filled is saved (see `claimScan`). */
  scanPending?: boolean;
}

type Tx = Parameters<Parameters<typeof withTransaction>[0]>[0];

const LINKED_TABLES = {
  billId: { table: bills, noun: "Bill" },
  expenseId: { table: expenses, noun: "Expense" },
  paymentId: { table: payments, noun: "Payment" },
  vendorPaymentId: { table: vendorPayments, noun: "Payment" },
  purchaseReturnId: { table: purchaseReturns, noun: "Purchase return" },
  invoiceId: { table: invoices, noun: "Invoice" },
  purchaseOrderId: { table: purchaseOrders, noun: "Purchase order" },
} as const;

/** The link as document columns, after checking the record exists. */
async function checkedLink(tx: Tx, link: DocumentLink): Promise<Partial<Record<DocumentLinkKey, number>>> {
  const parts = linkParts(link);
  if (!parts) return {};
  const [key, value] = parts;
  const { table, noun } = LINKED_TABLES[key];
  const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.id, value));
  if (!row) throw new DocumentInputError(`${noun} not found.`);
  return { [key]: row.id };
}

/** Scans kept this long without a save are removed. */
const PENDING_SCAN_HOURS = 24;

/**
 * Attaches a scan kept by `scanUpload` to the record its form just saved. Only the person
 * who scanned it can claim it, and only once; anything else is ignored, because the record
 * itself is already saved.
 */
export async function claimScan(documentId: number | null | undefined, link: NonNullable<DocumentLink>, user: CurrentUser) {
  if (!documentId || !Number.isSafeInteger(documentId) || documentId <= 0) return;
  try {
    await withTransaction(async (tx) => {
      const columns = await checkedLink(tx, link);
      await tx
        .update(documents)
        .set({ ...columns, scanPending: false })
        .where(and(eq(documents.id, documentId), eq(documents.scanPending, true), eq(documents.uploadedBy, user.id)));
    });
  } catch (err) {
    console.error("[documents] keeping the scan failed:", err instanceof Error ? err.message : err);
  }
}

/** The kept scan a form sends back as `scanDocumentId` (a form field or an input property). */
export function scanIdOf(source: unknown): number | null {
  const raw =
    source instanceof FormData
      ? source.get("scanDocumentId")
      : source && typeof source === "object"
        ? (source as Record<string, unknown>).scanDocumentId
        : null;
  const n = Number(raw);
  return raw != null && raw !== "" && Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Every kept scan a form sends back: `scanDocumentIds` (several scans added up) and `scanDocumentId`. */
export function scanIdsOf(source: unknown): number[] {
  const many = source && typeof source === "object" && !(source instanceof FormData) ? (source as Record<string, unknown>).scanDocumentIds : null;
  const ids = (Array.isArray(many) ? many.slice(0, 20) : []).map((raw) => scanIdOf({ scanDocumentId: raw }));
  return [...new Set([...ids, scanIdOf(source)].filter((n): n is number => n != null))];
}

/** Removes scans that were never saved with a form. */
export async function removeStaleScans() {
  await withTransaction((tx) =>
    tx
      .delete(documents)
      .where(and(eq(documents.scanPending, true), sql`${documents.createdAt} < now() - make_interval(hours => ${PENDING_SCAN_HOURS})`)),
  );
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

    const link = await checkedLink(tx, input.link);
    const [{ id }] = await tx
      .insert(documents)
      .values({
        title: input.title,
        folder: input.folder,
        mimeType: input.mimeType,
        size: input.bytes.length,
        // Only the owner can hide a document from staff.
        ownerOnly: input.ownerOnly && isOwner(user),
        ...link,
        scanPending: input.scanPending ?? false,
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

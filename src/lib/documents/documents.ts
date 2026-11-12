// Rules for the files kept under Documents. Used by the browser and the server.

import { z } from "zod";

/** Folders a document can be filed under, as key → name. */
export const DOCUMENT_FOLDERS = {
  bills: "Purchase bills",
  receipts: "Expense receipts",
  bank: "Bank",
  tax: "GST and tax",
  staff: "Staff",
  other: "Other",
} as const;
export type DocumentFolder = keyof typeof DOCUMENT_FOLDERS;
export const isDocumentFolder = (s: string): s is DocumentFolder => Object.hasOwn(DOCUMENT_FOLDERS, s);

export const DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];
export const isDocumentMimeType = (t: string): t is DocumentMimeType =>
  (DOCUMENT_MIME_TYPES as readonly string[]).includes(t);

const EXTENSIONS: Record<DocumentMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Largest file: hosting accepts about 4.5 MB per request, including form overhead. */
export const DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;
/** All files together. Keeps the database well inside its plan, so the rest of the app is never squeezed out. */
export const DOCUMENT_STORAGE_LIMIT = 300 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

/**
 * The file type read from the file's first bytes, or null when it is not one
 * we keep. The type the browser claims is never trusted.
 */
export function sniffMimeType(bytes: Uint8Array): DocumentMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

/** A title made from an uploaded file's name: no folders, no extension, no odd characters. */
export function titleFromFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim()
    .slice(0, 150);
  return cleaned || "Document";
}

/** A safe file name for downloading: the title plus the right extension. */
export function downloadName(title: string, mimeType: string): string {
  const base = title.replace(/[^\p{L}\p{M}\p{N} ._()-]/gu, "").trim().slice(0, 100) || "document";
  const ext = isDocumentMimeType(mimeType) ? EXTENSIONS[mimeType] : "bin";
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

/** 1536 → "1.5 KB" */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const detailsSchema = z.object({
  title: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "Give the document a name").max(150, "Name can be at most 150 characters"),
  ),
  folder: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().refine(isDocumentFolder, "Choose a folder")),
  docDate: z.preprocess((v) => (typeof v === "string" && v ? v : null), z.iso.date("Date is not valid").nullable()),
  notes: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().max(1000, "Notes can be at most 1000 characters"),
  ),
  ownerOnly: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export interface DocumentDetails {
  title: string;
  folder: DocumentFolder;
  docDate: string | null;
  notes: string;
  ownerOnly: boolean;
}

/** Checks the "document details" form. */
export function parseDocumentDetails(form: FormData): { value: DocumentDetails; error?: never } | { error: string; value?: never } {
  const parsed = detailsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the details." };
  return { value: parsed.data as DocumentDetails };
}

/** The record a document is attached to, if any. */
export type DocumentLink = { billId: number } | { expenseId: number } | null;

/** Reads the link sent with an upload. Anything unclear means "not attached". */
export function parseDocumentLink(form: FormData): DocumentLink {
  const id = (key: string) => {
    const n = Number(form.get(key));
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  };
  const billId = id("billId");
  if (billId) return { billId };
  const expenseId = id("expenseId");
  return expenseId ? { expenseId } : null;
}

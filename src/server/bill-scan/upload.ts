import "server-only";

import { isScanMimeType, SCAN_MAX_BYTES } from "@/lib/bills/scan";
import { DOCUMENT_MAX_BYTES, sniffMimeType, type DocumentFolder } from "@/lib/documents/documents";
import type { CurrentUser } from "@/server/auth";
import { createDocument, DocumentInputError, removeStaleScans } from "@/server/document-writes";

import { BillScanError, type BillFile } from "./reader";

export type ScanAnswer<T> =
  | {
      scan: T;
      /** The kept copy of the file, to send back with the save so it is attached. */
      keptId?: number;
      /** Why the file could not be kept, when it was meant to be. The scan still worked. */
      keepNote?: string;
      error?: never;
    }
  | { error: string; scan?: never };

/** Keep a copy of the scanned paper in Documents once the form it fills is saved. */
export interface KeepScan {
  user: CurrentUser;
  folder: DocumentFolder;
  title: string;
}

/**
 * Stores the small copy the browser sent as "keep", or the PDF itself (voice notes are never kept). It stays
 * hidden until `claimScan` attaches it to the saved record.
 */
async function keepCopy(formData: FormData, keep: KeepScan): Promise<{ keptId?: number; keepNote?: string }> {
  // A PDF is kept as it was sent for reading; a photo comes with its own small copy.
  const file = formData.get(formData.get("keepSame") === "1" ? "file" : "keep");
  if (!(file instanceof File) || file.size === 0) return {};
  if (file.size > DOCUMENT_MAX_BYTES) return { keepNote: "The file is too big to keep in Documents." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = sniffMimeType(bytes);
  if (!mimeType) return {};
  try {
    await removeStaleScans();
    const keptId = await createDocument(
      { title: keep.title, folder: keep.folder, ownerOnly: false, link: null, mimeType, bytes, scanPending: true },
      keep.user,
    );
    return { keptId };
  } catch (err) {
    if (err instanceof DocumentInputError) return { keepNote: `The file was not kept: ${err.message}` };
    console.error("[scan] keeping the file failed:", err instanceof Error ? err.message : err);
    return { keepNote: "The file could not be kept in Documents this time." };
  }
}

/**
 * Takes the uploaded photo or PDF from a scan form, reads it with `read` and turns
 * every failure into a message the user can act on. With `keep`, a small copy
 * the browser sent is kept for Documents; otherwise nothing is stored.
 */
export async function scanUpload<T>(
  formData: FormData,
  noun: string,
  read: (file: BillFile) => Promise<T>,
  keep?: KeepScan,
): Promise<ScanAnswer<T>> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: `Choose a photo or PDF of the ${noun}.` };
  if (!isScanMimeType(file.type)) return { error: `Use a photo (JPG or PNG) or a PDF of the ${noun}.` };
  if (file.size > SCAN_MAX_BYTES) return { error: `This file is too big. Use a file under 4 MB, or take a photo of the ${noun} instead.` };
  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const scan = await read({ data, mimeType: file.type });
    return { scan, ...(keep ? await keepCopy(formData, keep) : {}) };
  } catch (err) {
    if (err instanceof BillScanError) return { error: err.message };
    console.error(`[scan] ${noun} failed:`, err instanceof Error ? err.message : err);
    return { error: `Could not read the ${noun}. Please try again, or enter it by hand.` };
  }
}

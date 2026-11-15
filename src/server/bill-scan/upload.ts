import "server-only";

import { isScanMimeType, SCAN_MAX_BYTES } from "@/lib/bills/scan";

import { BillScanError, type BillFile } from "./reader";

export type ScanAnswer<T> = { scan: T; error?: never } | { error: string; scan?: never };

/**
 * Takes the uploaded photo or PDF from a scan form, reads it with `read` and turns
 * every failure into a message the user can act on. The file is not kept.
 */
export async function scanUpload<T>(formData: FormData, noun: string, read: (file: BillFile) => Promise<T>): Promise<ScanAnswer<T>> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: `Choose a photo or PDF of the ${noun}.` };
  if (!isScanMimeType(file.type)) return { error: `Use a photo (JPG or PNG) or a PDF of the ${noun}.` };
  if (file.size > SCAN_MAX_BYTES) return { error: `This file is too big. Use a file under 4 MB, or take a photo of the ${noun} instead.` };
  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    return { scan: await read({ data, mimeType: file.type }) };
  } catch (err) {
    if (err instanceof BillScanError) return { error: err.message };
    console.error(`[scan] ${noun} failed:`, err instanceof Error ? err.message : err);
    return { error: `Could not read the ${noun}. Please try again, or enter it by hand.` };
  }
}

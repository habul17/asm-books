import "server-only";

import type { ScanMimeType } from "@/lib/bills/scan";

/** A photo or PDF of one purchase bill. */
export interface BillFile {
  /** File contents, base64 encoded. */
  data: string;
  mimeType: ScanMimeType;
}

/**
 * Something that can read a bill and return what is printed on it, in the shape of
 * `SCANNED_BILL_JSON_SCHEMA`. The answer is untrusted and is checked by the caller.
 * Each reading service (provider) is one implementation.
 */
export interface BillReader {
  read(file: BillFile): Promise<unknown>;
}

/** A problem the user can act on; the message is safe to show. */
export class BillScanError extends Error {}

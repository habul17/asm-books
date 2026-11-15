import "server-only";

import type { ScanMimeType } from "@/lib/bills/scan";

/** A photo or PDF of one document: a bill, a receipt, a payment slip. */
export interface BillFile {
  /** File contents, base64 encoded. */
  data: string;
  mimeType: ScanMimeType;
}

/** What to read from a document and the shape of the answer. */
export interface ReadTask {
  /** What the document is, in plain words for messages: "bill", "receipt". */
  noun: string;
  /** The request sent with the file. */
  ask: string;
  /** Rules the reader follows. */
  instructions: string;
  /** JSON Schema of the answer. */
  schema: object;
}

/**
 * Something that can read a document and return what is printed on it, in the shape
 * of the task's schema. The answer is untrusted and is checked by the caller.
 * Each reading service (provider) is one implementation.
 */
export interface BillReader {
  read(file: BillFile, task: ReadTask): Promise<unknown>;
}

/** A problem the user can act on; the message is safe to show. */
export class BillScanError extends Error {}

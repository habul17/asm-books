import "server-only";

import { EXPENSE_CATEGORIES } from "@/lib/expenses/validation";
import { RECEIPT_INSTRUCTIONS, receiptJsonSchema, reviewReceipt, scannedReceiptSchema, type ReceiptDraft } from "@/lib/expenses/scan";
import { usedExpenseCategories } from "@/server/expenses";
import { todayInIndia } from "@/server/invoice-writes";

import { findVendor, readDocument } from "./index";
import { BillScanError, type BillFile } from "./reader";

export interface ReceiptScanResult extends ReceiptDraft {
  /** The saved vendor this receipt is from, when one matches. */
  vendorId: number | null;
}

/** Expense categories offered on the form: the suggested ones, then others used before. */
export async function expenseCategoryOptions(): Promise<string[]> {
  const used = await usedExpenseCategories();
  const seen = new Set<string>(EXPENSE_CATEGORIES.map((c) => c.toLowerCase()));
  return [...EXPENSE_CATEGORIES, ...used.filter((c) => !seen.has(c.toLowerCase()))];
}

/**
 * Reads an expense receipt and prepares values for the expense form. Nothing is
 * saved. The caller must have checked the user.
 */
export async function scanReceipt(file: BillFile): Promise<ReceiptScanResult> {
  const categories = await expenseCategoryOptions();
  const raw = await readDocument(file, {
    noun: "receipt",
    ask: "Read this expense receipt and return its contents.",
    instructions: RECEIPT_INSTRUCTIONS,
    schema: receiptJsonSchema(categories),
  });
  const parsed = scannedReceiptSchema.safeParse(raw);
  if (!parsed.success) throw new BillScanError("The receipt could not be read. Try a clearer photo.");
  const draft = reviewReceipt(parsed.data, { today: todayInIndia(), categories });
  const vendor = await findVendor(draft.sellerGstin, draft.paidTo);
  return { ...draft, vendorId: vendor?.id ?? null };
}

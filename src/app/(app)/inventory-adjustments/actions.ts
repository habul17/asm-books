"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { stockCheckLines, stockCheckSchema } from "@/lib/adjustments/stock-check";
import { parseAdjustmentInput } from "@/lib/adjustments/validation";
import { getDb } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { todayInIndia } from "@/server/invoice-writes";
import { AdjustmentInputError, cancelAdjustment, createAdjustment, updateAdjustment } from "@/server/adjustment-writes";
import { pickStockItems } from "@/server/adjustments";
import { isOwner, requireUser } from "@/server/auth";
import { scanCount, type CountScanResult } from "@/server/bill-scan/stock-count";
import { scanUpload, type ScanAnswer } from "@/server/bill-scan/upload";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof AdjustmentInputError) return { error: err.message };
  console.error(`[inventory-adjustments] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Records a new adjustment (id null) or changes a saved one, then opens it. */
export async function saveAdjustment(id: number | null, input: unknown): Promise<ActionState> {
  const user = await requireUser();
  if (id != null && !idSchema.safeParse(id).success) return { error: "Adjustment not found." };
  const parsed = parseAdjustmentInput(input);
  if (parsed.error !== undefined) return { error: parsed.error };
  let savedId: number;
  try {
    if (id == null) savedId = await createAdjustment(parsed.value, user.id);
    else {
      await updateAdjustment(id, parsed.value, user.id);
      savedId = id;
    }
  } catch (err) {
    return failure("save", err);
  }
  redirect(`/inventory-adjustments/${savedId}`);
}

export async function cancelAdjustmentAction(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can cancel. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Adjustment not found." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Please give a reason for cancelling." };
  if (reason.length > 500) return { error: "Reason can be at most 500 characters." };
  try {
    await cancelAdjustment(id, reason, user.id);
  } catch (err) {
    return failure("cancel", err);
  }
  refresh();
  return { ok: true };
}

// Lookup for the adjustment form. It only reads data.

export async function findStockItems(query: unknown) {
  return pickStockItems(typeof query === "string" ? query : "");
}

/** Reads a stock count sheet and returns the parts whose count differs. Nothing is saved. */
export async function scanCountAction(formData: FormData): Promise<ScanAnswer<CountScanResult>> {
  await requireUser();
  return scanUpload(formData, "count sheet", scanCount);
}

/**
 * Saves a stock check: for each part counted on the shelf, the difference from the
 * stock the app holds now becomes a "Stock count correction". Counts are what is on
 * the shelf, so a sale made while counting is already in them.
 */
export async function saveStockCheck(input: unknown): Promise<ActionState & { saved?: number[]; changed?: number }> {
  const user = await requireUser();
  const parsed = stockCheckSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the counts." };
  const { counts } = parsed.data;
  try {
    const now = await getDb()
      .select({ id: products.id, stockQty: products.stockQty })
      .from(products)
      .where(inArray(products.id, counts.map((c) => c.productId)));
    const ids = counts.map((c) => c.productId);
    const moved = await getDb()
      .selectDistinct({ id: stockMovements.productId })
      .from(stockMovements)
      .where(inArray(stockMovements.productId, ids));
    const movedIds = new Set(moved.map((m) => m.id));
    const chunks = stockCheckLines(
      counts,
      new Map(now.map((p) => [p.id, p.stockQty])),
      new Set(ids.filter((id) => !movedIds.has(id))),
    );
    if (!chunks.length) return { ok: true, saved: [], changed: 0 };
    const saved: number[] = [];
    for (const [i, { reason, lines }] of chunks.entries()) {
      const part = chunks.length > 1 ? ` (part ${i + 1} of ${chunks.length})` : "";
      saved.push(
        await createAdjustment(
          {
            date: todayInIndia(),
            reason,
            notes: `Stock check: ${counts.length} part${counts.length === 1 ? "" : "s"} counted on the shelf${part}.`,
            lines,
          },
          user.id,
        ),
      );
    }
    return { ok: true, saved, changed: chunks.reduce((n, c) => n + c.lines.length, 0) };
  } catch (err) {
    return failure("stock check", err);
  }
}

import "server-only";

import { inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { products } from "@/db/schema";
import { COUNT_INSTRUCTIONS, COUNT_JSON_SCHEMA, countLineLabel, countQty, scannedCountSchema } from "@/lib/adjustments/count-scan";
import { pickStockItems, type StockItem } from "@/server/adjustments";

import { findPart, partKeys } from "./find-part";
import { readDocument } from "./index";
import { BillScanError, type BillFile } from "./reader";

const COUNT_TASK = {
  noun: "count sheet",
  ask: "Read the parts and the counted quantities on this stock count sheet.",
  instructions: COUNT_INSTRUCTIONS,
  schema: COUNT_JSON_SCHEMA,
};

export interface CountScanResult {
  /** Parts whose count differs from the app's stock. */
  rows: { item: StockItem; counted: number }[];
  /** Parts counted that already match the app. */
  matching: number;
  warnings: string[];
}

/** Reads a stock count sheet and compares it with the app's stock. Nothing is saved. The caller must have checked the user. */
export async function scanCount(file: BillFile): Promise<CountScanResult> {
  const parsed = scannedCountSchema.safeParse(await readDocument(file, COUNT_TASK));
  if (!parsed.success) throw new BillScanError("The count sheet could not be read. Try a clearer photo.");
  const sheet = parsed.data;
  const warnings = [...sheet.doubts];
  if (!sheet.lines.length) warnings.push("No counted items were found on the sheet.");

  const byKey = await partKeys();
  const counts = new Map<number, { counted: number; rows: number }>();
  for (const [i, line] of sheet.lines.entries()) {
    const label = countLineLabel(line, i + 1);
    const counted = countQty(line.counted);
    if (counted == null) {
      warnings.push(`${label}: the count could not be read. Add it by hand.`);
      continue;
    }
    const part = await findPart(line, byKey, pickStockItems);
    if (!part) {
      warnings.push(`${label}: not found in your parts.`);
      continue;
    }
    if ("choices" in part) {
      const some = part.choices.slice(0, 4).join(", ") + (part.choices.length > 4 ? "…" : "");
      warnings.push(`${label}: ${part.choices.length} parts fit (${some}). Add the right one with the item search.`);
      continue;
    }
    if (!part.sure) warnings.push(`${label}: matched by search. Check it is the right part.`);
    const seen = counts.get(part.id);
    counts.set(part.id, { counted: Math.round(((seen?.counted ?? 0) + counted) * 1000) / 1000, rows: (seen?.rows ?? 0) + 1 });
  }

  const ids = [...counts.keys()];
  const items = ids.length
    ? await getDb()
        .select({ id: products.id, partNo: products.partNo, description: products.description, unit: products.unit, stockQty: products.stockQty })
        .from(products)
        .where(inArray(products.id, ids))
    : [];
  let matching = 0;
  const rows: CountScanResult["rows"] = [];
  for (const item of items) {
    const c = counts.get(item.id)!;
    if (c.rows > 1) warnings.push(`${item.partNo} was counted in ${c.rows} places; the counts were added together (${c.counted}).`);
    if (Math.abs(c.counted - item.stockQty) < 0.0005) matching++;
    else rows.push({ item, counted: c.counted });
  }
  return { rows, matching, warnings };
}

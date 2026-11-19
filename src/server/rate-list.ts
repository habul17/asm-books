import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, withTransaction } from "@/db";
import { products, purchasePrices } from "@/db/schema";
import { DESCRIPTION_MAX, PART_NO_MAX } from "@/lib/catalogue/product-validation";
import {
  MAX_RATE_LINES,
  RATE_LIST_INSTRUCTIONS,
  RATE_LIST_JSON_SCHEMA,
  reviewRateList,
  scannedRateListSchema,
  type RateReview,
} from "@/lib/catalogue/rate-list";
import { GST_RATES } from "@/lib/settings/business";
import { requireOwner } from "@/server/auth";
import { readDocument } from "@/server/bill-scan";
import { BillScanError, type BillFile } from "@/server/bill-scan/reader";
import { todayInIndia } from "@/server/invoice-writes";
import { purchasePriceAt, realPurchasePrice } from "@/server/product-search";
import { loadBusiness } from "@/server/settings";

const RATE_LIST_TASK = {
  noun: "rate list",
  ask: "Read every part and rate in this supplier rate list.",
  instructions: RATE_LIST_INSTRUCTIONS,
  schema: RATE_LIST_JSON_SCHEMA,
  // A long list is a long answer; give the main model time before the fallback.
  firstTryMs: 150_000,
};

/** Reads a supplier's rate list and compares it with the parts list. Owner only. Nothing is saved. */
export async function scanRateList(file: BillFile): Promise<RateReview> {
  await requireOwner();
  const parsed = scannedRateListSchema.safeParse(await readDocument(file, RATE_LIST_TASK));
  if (!parsed.success) throw new BillScanError("The rate list could not be read. Try a clearer photo or the PDF.");
  if (!parsed.data.lines.length) throw new BillScanError("No parts were found on this rate list.");
  const db = getDb();
  const [business, parts] = await Promise.all([
    loadBusiness(db),
    db
      .select({
        id: products.id,
        partNo: products.partNo,
        description: products.description,
        unit: products.unit,
        gstRate: products.gstRate,
        lastPrice: purchasePriceAt(0),
      })
      .from(products)
      .where(eq(products.active, true)),
  ]);
  return reviewRateList(parsed.data, { parts, defaultGstRate: business.defaultGstRate, today: todayInIndia() });
}

const price = z.number().positive().max(1e9);
const applySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplier: z.string().trim().max(200).nullable(),
  updates: z.array(z.object({ productId: z.number().int().positive(), price })).max(MAX_RATE_LINES),
  newParts: z
    .array(
      z.object({
        partNo: z.string().trim().min(1).max(PART_NO_MAX),
        description: z.string().trim().min(1).max(DESCRIPTION_MAX),
        hsn: z.string().nullable(),
        unit: z.string().trim().min(1).max(20),
        gstRate: z.number().refine((r) => (GST_RATES as readonly number[]).includes(r)),
        price,
      }),
    )
    .max(MAX_RATE_LINES),
});

export type RateListApply = z.infer<typeof applySchema>;

/** An HSN code kept only when it has the right shape. */
const cleanHsn = (h: string | null) => {
  const d = h?.replace(/\s/g, "") ?? "";
  return /^\d{4}(\d{2}){0,2}$/.test(d) ? d : null;
};

/**
 * Saves the approved rows of a rate list: a new purchase price for each changed part
 * and the new parts with their price, all at once. Owner only.
 */
export async function applyRateList(input: unknown): Promise<{ updated: number; added: number; skipped: string[] } | { error: string }> {
  await requireOwner();
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { error: "Some rows could not be saved. Check the prices and try again." };
  const { updates, newParts, supplier } = parsed.data;
  const today = todayInIndia();
  const date = parsed.data.date <= today ? parsed.data.date : today;
  const source = "rate-list";

  return withTransaction(async (tx) => {
    let updated = 0;
    const ids = [...new Set(updates.map((u) => u.productId))];
    if (ids.length) {
      const known = await tx.select({ id: products.id }).from(products).where(inArray(products.id, ids));
      const exists = new Set(known.map((k) => k.id));
      for (const u of updates) {
        if (!exists.has(u.productId)) continue;
        const [latest] = await tx
          .select({ price: purchasePrices.price })
          .from(purchasePrices)
          .where(and(eq(purchasePrices.productId, u.productId), realPurchasePrice))
          .orderBy(desc(purchasePrices.date), desc(purchasePrices.id))
          .limit(1);
        if (latest && Math.abs(latest.price - u.price) < 0.005) continue;
        await tx.insert(purchasePrices).values({ productId: u.productId, price: u.price, date, supplier, source });
        updated++;
      }
    }

    let added = 0;
    const skipped: string[] = [];
    for (const p of newParts) {
      const partNo = p.partNo.replace(/\s+/g, " ");
      const [taken] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(sql`lower(${products.partNo})`, partNo.toLowerCase()))
        .limit(1);
      if (taken) {
        skipped.push(partNo);
        continue;
      }
      const [row] = await tx
        .insert(products)
        .values({
          partNo,
          description: p.description.replace(/\s+/g, " "),
          hsn: cleanHsn(p.hsn),
          unit: p.unit,
          gstRate: p.gstRate,
          active: true,
        })
        .returning({ id: products.id });
      await tx.insert(purchasePrices).values({ productId: row.id, price: p.price, date, supplier, source });
      added++;
    }
    return { updated, added, skipped };
  });
}

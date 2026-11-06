import "server-only";

import { connection } from "next/server";

import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { categories, priceListFolders, priceListItems, priceLists, products } from "@/db/schema";
import { computePrice, round2, type PriceRule } from "@/lib/pricing";

import { productSearch, purchasePriceAt } from "./product-search";

export const PRICES_PAGE = 100;
export const PRICES_MAX = 2000;

const listColumns = {
  id: priceLists.id,
  name: priceLists.name,
  folderId: priceLists.folderId,
  base: priceLists.base,
  adjustType: priceLists.adjustType,
  adjustPct: priceLists.adjustPct,
  discountPct: priceLists.discountPct,
  roundTo: priceLists.roundTo,
  enabled: priceLists.enabled,
  notes: priceLists.notes,
  sort: priceLists.sort,
};

/** All folders and (not deleted) price lists, with how many manual prices each list has. */
export async function getPriceListTree() {
  await connection(); // Always read live data; never prerender at build time.
  const db = getDb();
  const [folders, lists] = await db.batch([
    db
      .select({ id: priceListFolders.id, name: priceListFolders.name, parentId: priceListFolders.parentId })
      .from(priceListFolders),
    db
      .select({
        ...listColumns,
        manualCount: sql<number>`(
          SELECT count(*) FROM ${priceListItems} WHERE ${priceListItems.priceListId} = ${priceLists.id}
        )`.mapWith(Number),
      })
      .from(priceLists)
      .where(isNull(priceLists.deletedAt))
      .orderBy(asc(priceLists.sort), asc(priceLists.id)),
  ]);
  return { folders, lists };
}

export type PriceListTree = Awaited<ReturnType<typeof getPriceListTree>>;
export type PriceListRow = PriceListTree["lists"][number];
export type FolderRow = PriceListTree["folders"][number];

export interface ListPriceRow {
  id: number;
  partNo: string;
  description: string;
  /** The price the rule starts from (purchase, previous purchase or list price). */
  base: number | null;
  purchase: number | null;
  /** Price from the rule alone, ignoring any manual price. */
  rulePrice: number | null;
  manualPrice: number | null;
  /** Price actually charged: the manual price if set, otherwise the rule price. */
  price: number | null;
  profit: number | null;
}

/** Products with their price in one list, filtered by the search box. */
export async function getListPrices(
  list: PriceRule & { id: number },
  options: { query: string; manualOnly: boolean; limit: number },
): Promise<{ total: number; items: ListPriceRow[] }> {
  await connection(); // Always read live data; never prerender at build time.
  const db = getDb();
  const join = and(eq(priceListItems.productId, products.id), eq(priceListItems.priceListId, list.id));
  const { where, rank } = productSearch(options.query, [
    options.manualOnly ? isNotNull(priceListItems.manualPrice) : undefined,
  ]);
  const limit = Math.min(Math.max(options.limit, 1), PRICES_MAX);

  const [countRows, rows] = await db.batch([
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(priceListItems, join)
      .where(where),
    db
      .select({
        id: products.id,
        partNo: products.partNo,
        description: products.description,
        list: products.listPrice,
        purchase: purchasePriceAt(0),
        previousPurchase: purchasePriceAt(1),
        manualPrice: priceListItems.manualPrice,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(priceListItems, join)
      .where(where)
      .orderBy(rank, asc(products.sort), asc(products.id))
      .limit(limit),
  ]);

  const items = rows.map((p): ListPriceRow => {
    const bases = { purchase: p.purchase, previous_purchase: p.previousPurchase, list: p.list };
    const rule = computePrice(list, bases);
    const price = p.manualPrice ?? rule.price;
    return {
      id: p.id,
      partNo: p.partNo,
      description: p.description,
      base: rule.base,
      purchase: p.purchase,
      rulePrice: rule.price,
      manualPrice: p.manualPrice,
      price,
      profit: price != null && p.purchase != null ? round2(price - p.purchase) : null,
    };
  });

  return { total: countRows[0]?.total ?? 0, items };
}

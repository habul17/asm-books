import "server-only";

import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/db";
import {
  brands,
  categories,
  priceListFolders,
  priceListItems,
  priceLists,
  products,
  purchasePrices,
} from "@/db/schema";
import { computePrice, type ComputedPrice } from "@/lib/pricing";

const MAX_WORDS = 8;
export const SEARCH_LIMIT = 50;

const group = alias(categories, "category_group");

/** Escapes LIKE wildcards so user input is matched literally. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Newest purchase price of the product in the outer query. */
const currentPurchasePrice = sql<number | null>`(
  SELECT ${purchasePrices.price} FROM ${purchasePrices}
  WHERE ${purchasePrices.productId} = ${products.id}
  ORDER BY ${purchasePrices.date} DESC, ${purchasePrices.id} DESC
  LIMIT 1
)`.mapWith(Number);

export interface ProductSearchResult {
  total: number;
  items: {
    id: number;
    partNo: string;
    description: string;
    category: string | null;
    categoryGroup: string | null;
    stockQty: number;
    purchasePrice: number | null;
  }[];
}

/**
 * Every word must appear in the part number, description or category name.
 * Group names are not searched: they are too broad and flood the results.
 * Exact part-number matches come first, then part numbers starting with the query.
 */
export async function searchProducts(query: string, limit = SEARCH_LIMIT): Promise<ProductSearchResult> {
  const q = query.trim().slice(0, 200);
  const words = q.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);

  const conditions: SQL[] = [eq(products.active, true)];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(
      or(ilike(products.partNo, like), ilike(products.description, like), ilike(categories.name, like))!,
    );
  }
  const where = and(...conditions);
  const db = getDb();

  const rank = sql`CASE
    WHEN ${products.partNo} ILIKE ${escapeLike(q)} THEN 0
    WHEN ${products.partNo} ILIKE ${`${escapeLike(q)}%`} THEN 1
    ELSE 2 END`;

  const [countRows, items] = await db.batch([
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(where),
    db
      .select({
        id: products.id,
        partNo: products.partNo,
        description: products.description,
        category: categories.name,
        categoryGroup: group.name,
        stockQty: products.stockQty,
        purchasePrice: currentPurchasePrice,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(group, eq(group.id, categories.parentId))
      .where(where)
      .orderBy(rank, asc(products.sort), asc(products.id))
      .limit(Math.min(Math.max(limit, 1), 200)),
  ]);

  return { total: countRows[0]?.total ?? 0, items };
}

export interface SellingPrice extends ComputedPrice {
  id: number;
  name: string;
  folder: string;
}

export async function getProduct(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = getDb();

  const [productRows, history, lists, folders] = await db.batch([
    db
      .select({
        id: products.id,
        partNo: products.partNo,
        description: products.description,
        hsn: products.hsn,
        unit: products.unit,
        gstRate: products.gstRate,
        listPrice: products.listPrice,
        photo: products.photo,
        stockQty: products.stockQty,
        minStock: products.minStock,
        brand: brands.name,
        category: categories.name,
        categoryGroup: group.name,
      })
      .from(products)
      .leftJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(group, eq(group.id, categories.parentId))
      .where(eq(products.id, id)),
    db
      .select({
        id: purchasePrices.id,
        price: purchasePrices.price,
        date: purchasePrices.date,
        supplier: purchasePrices.supplier,
        billRef: purchasePrices.billRef,
        source: purchasePrices.source,
      })
      .from(purchasePrices)
      .where(eq(purchasePrices.productId, id))
      .orderBy(desc(purchasePrices.date), desc(purchasePrices.id)),
    db
      .select({
        id: priceLists.id,
        name: priceLists.name,
        folderId: priceLists.folderId,
        base: priceLists.base,
        adjustType: priceLists.adjustType,
        adjustPct: priceLists.adjustPct,
        discountPct: priceLists.discountPct,
        roundTo: priceLists.roundTo,
        manualPrice: priceListItems.manualPrice,
      })
      .from(priceLists)
      .leftJoin(
        priceListItems,
        and(eq(priceListItems.priceListId, priceLists.id), eq(priceListItems.productId, id)),
      )
      .where(and(isNull(priceLists.deletedAt), eq(priceLists.enabled, true)))
      .orderBy(asc(priceLists.folderId), asc(priceLists.sort), asc(priceLists.id)),
    db
      .select({ id: priceListFolders.id, name: priceListFolders.name, parentId: priceListFolders.parentId })
      .from(priceListFolders),
  ]);

  const product = productRows[0];
  if (!product) return null;

  const purchasePrice = history[0]?.price ?? null;
  const previousPurchasePrice = history[1]?.price ?? null;

  const folderById = new Map(folders.map((f) => [f.id, f]));
  const folderPath = (folderId: number | null) => {
    const parts: string[] = [];
    for (let f = folderId != null ? folderById.get(folderId) : undefined, guard = 0; f && guard < 50; guard++) {
      parts.unshift(f.name);
      f = f.parentId != null ? folderById.get(f.parentId) : undefined;
    }
    return parts.join(" › ");
  };

  const bases = { purchase: purchasePrice, previous_purchase: previousPurchasePrice, list: product.listPrice };
  const sellingPrices: SellingPrice[] = lists.map((l) => ({
    id: l.id,
    name: l.name,
    folder: folderPath(l.folderId),
    ...computePrice(l, bases, l.manualPrice),
  }));

  return {
    ...product,
    purchasePrice,
    previousPurchasePrice,
    priceChange:
      purchasePrice != null && previousPurchasePrice != null ? purchasePrice - previousPurchasePrice : null,
    history,
    sellingPrices,
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

import "server-only";

import { connection } from "next/server";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/db";
import { isOwner, requireUser } from "@/server/auth";
import {
  brands,
  categories,
  priceListFolders,
  priceListItems,
  priceLists,
  products,
  purchasePrices,
} from "@/db/schema";
import { folderPathResolver } from "@/lib/price-lists/folders";
import { computePrice, type ComputedPrice } from "@/lib/pricing";

import { productSearch, purchasePriceAt } from "./product-search";

export const SEARCH_LIMIT = 50;

const group = alias(categories, "category_group");

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
    active: boolean;
  }[];
}

/** Products matching the search box; see `productSearch` for the rules. The owner also sees switched-off parts. */
export async function searchProducts(query: string, limit = SEARCH_LIMIT): Promise<ProductSearchResult> {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  const { where, rank } = productSearch(query, [], { includeOff: isOwner(user) });
  const db = getDb();

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
        purchasePrice: purchasePriceAt(0),
        active: products.active,
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
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
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
        active: products.active,
        categoryId: products.categoryId,
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

  const folderPath = folderPathResolver(folders);

  const bases = { purchase: purchasePrice, previous_purchase: previousPurchasePrice, list: product.listPrice };
  const sellingPrices: SellingPrice[] = lists.map((l) => ({
    id: l.id,
    name: l.name,
    folder: folderPath(l.folderId),
    ...computePrice(l, bases, l.manualPrice),
  }));

  return {
    ...product,
    canEdit: isOwner(user),
    purchasePrice,
    previousPurchasePrice,
    priceChange:
      purchasePrice != null && previousPurchasePrice != null ? purchasePrice - previousPurchasePrice : null,
    history,
    sellingPrices,
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

/** Choices for the add/edit part form: brands, categories under their main group, and units in use. */
export async function getProductFormOptions() {
  await connection();
  await requireUser();
  const db = getDb();
  const [brandRows, categoryRows, unitRows] = await db.batch([
    db.select({ name: brands.name }).from(brands).orderBy(asc(brands.name)),
    db
      .select({ id: categories.id, name: categories.name, parentId: categories.parentId, sort: categories.sort })
      .from(categories)
      .orderBy(asc(categories.sort), asc(categories.name)),
    db.selectDistinct({ unit: products.unit }).from(products).orderBy(asc(products.unit)),
  ]);
  const groups = categoryRows.filter((c) => c.parentId == null);
  const categoryGroups = groups.map((g) => ({
    id: g.id,
    name: g.name,
    children: categoryRows.filter((c) => c.parentId === g.id).map(({ id, name }) => ({ id, name })),
  }));
  return {
    brands: brandRows.map((b) => b.name),
    categoryGroups,
    units: [...new Set(["Nos", ...unitRows.map((u) => u.unit)])],
  };
}

export type ProductFormOptions = Awaited<ReturnType<typeof getProductFormOptions>>;

import "server-only";

import { connection } from "next/server";

import { and, asc, desc, eq, isNull, not, sql } from "drizzle-orm";
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
import { computePrice, highest, type ComputedPrice } from "@/lib/pricing";

import { itemStatus, PACE_DAYS, type ItemStatus, type ItemsShow, BUY_SOON_DAYS } from "@/lib/stock/item-status";

import { loadStockLots } from "./fifo";
import { priceItems } from "./invoices";
import { todayInIndia } from "./invoice-writes";
import { shift, soldBetween } from "./movement";
import { productSearch, realPurchasePrice } from "./product-search";
import { slowStockWhere } from "./reports";
import { loadBusiness } from "./settings";

export const SEARCH_LIMIT = 50;

const group = alias(categories, "category_group");

export interface ProductSearchResult {
  total: number;
  items: {
    id: number;
    partNo: string;
    description: string;
    photo: string | null;
    category: string | null;
    categoryGroup: string | null;
    unit: string;
    stockQty: number;
    /** Selling price of one piece on the default price list. */
    price: number | null;
    /** Owner only: what the next piece sold costs. Null for staff. */
    cost: number | null;
    status: ItemStatus;
    active: boolean;
  }[];
}

/**
 * Products matching the search box; see `productSearch` for the rules. The owner also sees switched-off parts.
 * `show` narrows to parts to buy soon, out of stock, or slow.
 */
export async function searchProducts(query: string, limit = SEARCH_LIMIT, show: ItemsShow = "all"): Promise<ProductSearchResult> {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  const owner = isOwner(user);
  const today = todayInIndia();
  const sold = soldBetween(shift(today, -(PACE_DAYS - 1)), today);
  const filter =
    show === "out"
      ? sql`${products.stockQty} <= 0`
      : show === "buy"
        ? sql`${sold} > 0 AND ${products.stockQty} * ${PACE_DAYS} < ${BUY_SOON_DAYS} * ${sold}`
        : show === "slow"
          ? slowStockWhere(today)
          : undefined;
  const { where, rank } = productSearch(query, [filter], { includeOff: owner && show === "all" });
  const db = getDb();

  const [countRows, rows, business] = await Promise.all([
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
        photo: products.photo,
        category: categories.name,
        categoryGroup: group.name,
        unit: products.unit,
        stockQty: products.stockQty,
        active: products.active,
        sold,
        slow: sql<boolean>`coalesce((${slowStockWhere(today)}), false)`,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(group, eq(group.id, categories.parentId))
      .where(where)
      .orderBy(rank, asc(products.sort), asc(products.id))
      .limit(Math.min(Math.max(limit, 1), 200)),
    loadBusiness(db),
  ]);

  const priced = new Map((await priceItems(rows.map((r) => r.id), business.defaultPriceListId)).map((p) => [p.id, p]));
  return {
    total: countRows[0]?.total ?? 0,
    items: rows.map(({ sold: soldQty, slow, ...r }) => {
      const p = priced.get(r.id);
      return {
        ...r,
        price: p?.price ?? null,
        cost: owner ? (p?.nextCost ?? null) : null,
        status: itemStatus({ stockQty: r.stockQty, sold: soldQty, slow: Boolean(slow) }),
      };
    }),
  };
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

  const [productRows, history, lists, folders, referenceRows] = await db.batch([
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
      .where(and(eq(purchasePrices.productId, id), realPurchasePrice))
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
    // The supplier's price list (the imported Excel), kept apart from real bill prices.
    db
      .select({ price: purchasePrices.price })
      .from(purchasePrices)
      .where(and(eq(purchasePrices.productId, id), not(realPurchasePrice)))
      .orderBy(desc(purchasePrices.date), desc(purchasePrices.id))
      .limit(1),
  ]);

  const product = productRows[0];
  if (!product) return null;

  // First in, first out: selling prices follow the batch that sells next, not the newest bill.
  const stock = (await loadStockLots(db, [id])).get(id);
  const lots = stock?.lots ?? [];
  const newestPurchasePrice = history[0]?.price ?? null;
  const purchasePrice = lots[0]?.cost ?? stock?.shortCost ?? newestPurchasePrice;
  const previousPurchasePrice = history[1]?.price ?? null;

  const folderPath = folderPathResolver(folders);

  const highestPurchasePrice = highest(...history.map((h) => h.price), purchasePrice);
  const bases = {
    purchase: purchasePrice,
    previous_purchase: previousPurchasePrice,
    highest_purchase: highestPurchasePrice,
    list: product.listPrice,
  };
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
    newestPurchasePrice,
    /** The supplier's price-list rate (from the imported Excel). */
    referencePrice: referenceRows[0]?.price ?? null,
    /** How the price that sells next compares with the supplier's price list. */
    sellsNextChange:
      purchasePrice != null && referenceRows[0]?.price != null ? purchasePrice - referenceRows[0].price : null,
    /** Stock on hand by purchase bill, oldest (sells next) first. */
    lots,
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

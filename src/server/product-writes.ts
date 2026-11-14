import "server-only";

import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";

import { getDb, withTransaction, type Tx } from "@/db";
import { brands, categories, products, purchasePrices } from "@/db/schema";
import type { ProductInput } from "@/lib/catalogue/product-validation";

/** A problem with the form that the person can fix, such as a part no that is already used. */
export class ProductInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductInputError";
  }
}

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";

const todayInIndia = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Finds a brand by name (ignoring case), adding it when it is new. */
async function brandIdFor(tx: Tx, name: string | null): Promise<number | null> {
  if (!name) return null;
  const find = () =>
    tx
      .select({ id: brands.id })
      .from(brands)
      .where(sql`lower(${brands.name}) = lower(${name})`)
      .limit(1);
  const [found] = await find();
  if (found) return found.id;
  await tx.insert(brands).values({ name }).onConflictDoNothing();
  const [added] = await find();
  return added.id;
}

/**
 * Finds a main group (parentId null) or a category under one by name, ignoring case,
 * adding it when it is new. Only two levels exist, so a new category always sits under a main group.
 */
async function categoryIdFor(tx: Tx, name: string, parentId: number | null): Promise<number> {
  const find = () =>
    tx
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          sql`lower(${categories.name}) = lower(${name})`,
          parentId == null ? isNull(categories.parentId) : eq(categories.parentId, parentId),
        ),
      )
      .limit(1);
  const [found] = await find();
  if (found) return found.id;
  await tx.insert(categories).values({ name, parentId }).onConflictDoNothing();
  const [added] = await find();
  return added.id;
}

/** Checks everything that needs the database, then returns the columns to save. */
async function prepare(tx: Tx, input: ProductInput, id: number | null) {
  const [taken] = await tx
    .select({ id: products.id })
    .from(products)
    .where(and(sql`lower(${products.partNo}) = lower(${input.partNo})`, id == null ? undefined : ne(products.id, id)))
    .limit(1);
  if (taken) throw new ProductInputError(`Part no ${input.partNo} is already in the list.`);

  let categoryId: number | null = null;
  if (input.category && "id" in input.category) {
    const [cat] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, input.category.id));
    if (!cat) throw new ProductInputError("Choose a category from the list");
    categoryId = cat.id;
  } else if (input.category) {
    const groupId = await categoryIdFor(tx, input.category.group, null);
    categoryId = await categoryIdFor(tx, input.category.name, groupId);
  }

  return {
    partNo: input.partNo,
    description: input.description,
    brandId: await brandIdFor(tx, input.brand),
    categoryId,
    hsn: input.hsn,
    unit: input.unit,
    gstRate: input.gstRate,
    listPrice: input.listPrice,
    minStock: input.minStock,
  };
}

/** Records a purchase price typed into the form, unless it is the same as the newest one. */
async function recordPrice(tx: Tx, productId: number, price: number | null) {
  if (price == null) return;
  const [latest] = await tx
    .select({ price: purchasePrices.price })
    .from(purchasePrices)
    .where(eq(purchasePrices.productId, productId))
    .orderBy(desc(purchasePrices.date), desc(purchasePrices.id))
    .limit(1);
  if (latest && Math.abs(latest.price - price) < 0.005) return;
  await tx.insert(purchasePrices).values({ productId, price, date: todayInIndia(), source: "manual" });
}

const translate = (err: unknown): never => {
  if (isUniqueViolation(err)) throw new ProductInputError("This part no is already in the list.");
  throw err;
};

/** Adds a part. New parts start switched on with no stock; stock comes from bills and stock changes. */
export async function createProduct(input: ProductInput): Promise<number> {
  return withTransaction(async (tx) => {
    const values = await prepare(tx, input, null);
    const [row] = await tx
      .insert(products)
      .values({ ...values, active: true })
      .returning({ id: products.id });
    await recordPrice(tx, row.id, input.purchasePrice);
    return row.id;
  }).catch(translate);
}

/** Changes a part. Returns false if it does not exist. Stock is never changed here. */
export async function updateProduct(id: number, input: ProductInput): Promise<boolean> {
  return withTransaction(async (tx) => {
    const values = await prepare(tx, input, id);
    const rows = await tx
      .update(products)
      .set({ ...values, active: input.active })
      .where(eq(products.id, id))
      .returning({ id: products.id });
    if (rows.length === 0) return false;
    await recordPrice(tx, id, input.purchasePrice);
    return true;
  }).catch(translate);
}

/** Sets or clears a product's minimum stock. Returns false if the product does not exist. */
export async function setMinStock(productId: number, minStock: number | null): Promise<boolean> {
  const rows = await getDb()
    .update(products)
    .set({ minStock })
    .where(eq(products.id, productId))
    .returning({ id: products.id });
  return rows.length > 0;
}

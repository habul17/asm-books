// Imports the supplier price-list spreadsheet into the database.
//
// Safe by default:
//   - Dry run unless --apply is given: every change is made inside a
//     transaction and then rolled back, so the summary is exact.
//   - Re-running is harmless: existing parts are updated only when something
//     changed, and a purchase price is recorded only when it differs from the
//     current one. Nothing is ever deleted.
//
// Usage:
//   pnpm import:price-list "<path/to/file.xlsx>"            # preview
//   pnpm import:price-list "<path/to/file.xlsx>" --apply    # write

import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ExcelJS from "exceljs";

import * as schema from "../src/db/schema";
import { parsePriceListRows, type RawRow } from "../src/lib/catalogue/price-list-import";

const { brands, categories, products, purchasePrices } = schema;

const DEFAULT_BRAND = "SuperMN Auto";
const CHUNK = 500;

class DryRun extends Error {}

function todayInIndia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function readRows(file: string): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The spreadsheet has no sheets.");

  const rows: RawRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    rows.push({
      partNo: row.getCell(2).value,
      hsn: row.getCell(3).value,
      description: row.getCell(4).value,
      price: row.getCell(5).value,
    });
  });
  return rows;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      apply: { type: "boolean", default: false },
      date: { type: "string", default: todayInIndia() },
      brand: { type: "string", default: DEFAULT_BRAND },
    },
  });

  const file = positionals[0] && path.resolve(positionals[0]);
  if (!file || !existsSync(file)) {
    console.error('Usage: pnpm import:price-list "<file.xlsx>" [--apply] [--date YYYY-MM-DD]');
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
    console.error("--date must be YYYY-MM-DD");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const parsed = parsePriceListRows(await readRows(file));
  const source = `excel:${path.basename(file)}`;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });

  const stats = {
    productsAdded: 0,
    productsUpdated: 0,
    productsUnchanged: 0,
    pricesRecorded: 0,
    categoriesAdded: 0,
  };

  try {
    await db.transaction(async (tx) => {
      // Brand
      const [brand] = await tx
        .insert(brands)
        .values({ name: values.brand })
        .onConflictDoUpdate({ target: brands.name, set: { name: values.brand } })
        .returning({ id: brands.id });

      // Categories: main groups first, then categories inside them.
      const key = (parent: string | null, name: string) => `${parent ?? ""}\u0000${name}`;
      const categoryIds = new Map<string, number>();
      const loadCategories = async () => {
        const all = await tx
          .select({ id: categories.id, name: categories.name, parentId: categories.parentId })
          .from(categories);
        const byId = new Map(all.map((c) => [c.id, c]));
        categoryIds.clear();
        for (const c of all) {
          const parent = c.parentId != null ? (byId.get(c.parentId)?.name ?? null) : null;
          categoryIds.set(key(parent, c.name), c.id);
        }
      };

      await loadCategories();
      const before = categoryIds.size;
      const roots = parsed.categories.filter((c) => c.parent === null);
      if (roots.length) {
        await tx
          .insert(categories)
          .values(roots.map((c) => ({ name: c.name, parentId: null, sort: c.sort })))
          .onConflictDoNothing();
      }
      await loadCategories();
      const children = parsed.categories.filter((c) => c.parent !== null);
      if (children.length) {
        await tx
          .insert(categories)
          .values(
            children.map((c) => ({
              name: c.name,
              parentId: categoryIds.get(key(null, c.parent!))!,
              sort: c.sort,
            })),
          )
          .onConflictDoNothing();
      }
      await loadCategories();
      stats.categoriesAdded = categoryIds.size - before;

      // Products: insert new ones, update only the ones that changed.
      const existing = new Map(
        (await tx.select({ partNo: products.partNo }).from(products)).map((p) => [p.partNo, true]),
      );
      const rows = parsed.products.map((p) => ({
        partNo: p.partNo,
        description: p.description,
        hsn: p.hsn,
        brandId: brand.id,
        categoryId: p.category
          ? (categoryIds.get(key(p.group, p.category)) ?? null)
          : p.group
            ? (categoryIds.get(key(null, p.group)) ?? null)
            : null,
        sort: p.sort,
      }));

      for (const batch of chunks(rows)) {
        const changed = await tx
          .insert(products)
          .values(batch)
          .onConflictDoUpdate({
            target: products.partNo,
            set: {
              description: sql`excluded.description`,
              hsn: sql`excluded.hsn`,
              brandId: sql`excluded.brand_id`,
              categoryId: sql`excluded.category_id`,
              sort: sql`excluded.sort`,
              updatedAt: sql`now()`,
            },
            setWhere: sql`(${products.description}, ${products.hsn}, ${products.brandId}, ${products.categoryId}, ${products.sort})
              IS DISTINCT FROM (excluded.description, excluded.hsn, excluded.brand_id, excluded.category_id, excluded.sort)`,
          })
          .returning({ partNo: products.partNo });
        for (const { partNo } of changed) {
          if (existing.has(partNo)) stats.productsUpdated++;
          else stats.productsAdded++;
        }
      }
      stats.productsUnchanged = rows.length - stats.productsAdded - stats.productsUpdated;

      // Purchase prices: record only when different from the current price.
      const ids = new Map(
        (await tx.select({ id: products.id, partNo: products.partNo }).from(products)).map((p) => [
          p.partNo,
          p.id,
        ]),
      );
      const current = new Map<number, number>();
      const latest = await tx.execute<{ product_id: number; price: string }>(sql`
        SELECT DISTINCT ON (product_id) product_id, price
        FROM ${purchasePrices}
        ORDER BY product_id, date DESC, id DESC`);
      for (const r of latest.rows) current.set(Number(r.product_id), Number(r.price));

      const newPrices = parsed.products
        .filter((p) => p.price != null)
        .map((p) => ({ productId: ids.get(p.partNo)!, price: p.price! }))
        .filter(({ productId, price }) => {
          const now = current.get(productId);
          return now == null || Math.abs(now - price) > 1e-9;
        })
        .map(({ productId, price }) => ({ productId, price, date: values.date, source }));

      for (const batch of chunks(newPrices)) {
        await tx.insert(purchasePrices).values(batch);
      }
      stats.pricesRecorded = newPrices.length;

      if (!values.apply) throw new DryRun();
    });
  } catch (err) {
    if (!(err instanceof DryRun)) throw err;
  } finally {
    await pool.end();
  }

  const noPrice = parsed.products.filter((p) => p.price == null).length;
  console.log(values.apply ? "✓ Import applied" : "Preview only (nothing saved). Add --apply to save.");
  console.log(`  File:              ${path.basename(file)}`);
  console.log(`  Products in file:  ${parsed.products.length}`);
  console.log(`  Added:             ${stats.productsAdded}`);
  console.log(`  Updated:           ${stats.productsUpdated}`);
  console.log(`  Unchanged:         ${stats.productsUnchanged}`);
  console.log(`  New prices:        ${stats.pricesRecorded} (dated ${values.date})`);
  console.log(`  New categories:    ${stats.categoriesAdded}`);
  if (noPrice) console.log(`  Without price:     ${noPrice}`);
  if (parsed.duplicates.length) {
    console.log(`  Duplicates skipped (first copy kept): ${parsed.duplicates.join(", ")}`);
  }
}

main().catch((err) => {
  const message = String(err?.message ?? err).replace(/postgres(ql)?:\/\/\S+/gi, "[redacted]");
  console.error(`✖ Import failed, nothing was saved: ${message}`);
  process.exit(1);
});

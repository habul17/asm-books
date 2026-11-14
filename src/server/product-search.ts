import "server-only";

import { and, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { categories, products, purchasePrices } from "@/db/schema";
import { col } from "@/db/sql";

const MAX_WORDS = 8;

/** Escapes LIKE wildcards so user input is matched literally. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The newest (offset 0) or previous (offset 1) purchase price of the product in the outer query. */
export const purchasePriceAt = (offset: 0 | 1) =>
  sql<number | null>`(
    SELECT ${col(purchasePrices.price)} FROM ${purchasePrices}
    WHERE ${col(purchasePrices.productId)} = ${col(products.id)}
    ORDER BY ${col(purchasePrices.date)} DESC, ${col(purchasePrices.id)} DESC
    LIMIT 1 OFFSET ${sql.raw(String(offset))}
  )`.mapWith(Number);

/**
 * Search rules shared by every product list in the app.
 *
 * Every word must appear in the part number, description or category name.
 * Group names are not searched: they are too broad and flood the results.
 * `rank` puts exact part-number matches first, then part numbers starting
 * with the query. The query must join `categories` on `products.category_id`.
 * Switched-off parts are left out unless `includeOff` (the owner's Items list).
 */
export function productSearch(query: string, extra: (SQL | undefined)[] = [], { includeOff = false } = {}) {
  const q = query.trim().slice(0, 200);
  const words = q.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);

  const conditions: (SQL | undefined)[] = [includeOff ? undefined : eq(products.active, true), ...extra];
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    conditions.push(or(ilike(products.partNo, like), ilike(products.description, like), ilike(categories.name, like)));
  }

  const rank = sql`CASE
    WHEN ${products.partNo} ILIKE ${escapeLike(q)} THEN 0
    WHEN ${products.partNo} ILIKE ${`${escapeLike(q)}%`} THEN 1
    ELSE 2 END`;

  return { where: and(...conditions), rank };
}

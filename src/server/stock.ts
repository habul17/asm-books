import "server-only";

import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { products } from "@/db/schema";
import type { StockRow } from "@/lib/stock/filter";
import { isOwner, requireUser } from "@/server/auth";

import { newestPurchasePrice } from "./reports";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Every active part with its stock, and for the owner what that stock cost.
 * Valued at each part's newest purchase price, the same way as the Home screen's
 * stock value, so the two totals agree.
 */
export async function stockOverview(): Promise<{ owner: boolean; items: StockRow[] }> {
  await connection(); // Always read live data; never prerender at build time.
  const owner = isOwner(await requireUser());
  const rows = await getDb()
    .select({
      id: products.id,
      partNo: products.partNo,
      description: products.description,
      unit: products.unit,
      photo: products.photo,
      stockQty: products.stockQty,
      cost: newestPurchasePrice,
    })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.partNo));
  return {
    owner,
    items: rows.map((r) => {
      const cost = owner && r.cost != null ? Number(r.cost) : null;
      return {
        ...r,
        cost,
        value: owner ? round2(Math.max(r.stockQty, 0) * (cost ?? 0)) : null,
      };
    }),
  };
}

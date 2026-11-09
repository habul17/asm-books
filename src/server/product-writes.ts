import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { products } from "@/db/schema";

/** Sets or clears a product's minimum stock. Returns false if the product does not exist. */
export async function setMinStock(productId: number, minStock: number | null): Promise<boolean> {
  const rows = await getDb()
    .update(products)
    .set({ minStock })
    .where(eq(products.id, productId))
    .returning({ id: products.id });
  return rows.length > 0;
}

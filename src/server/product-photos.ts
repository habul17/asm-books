import "server-only";

import { createHash } from "node:crypto";

import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { productPhotos, products } from "@/db/schema";
import { partFamily, RELATED_PARTS_MAX } from "@/lib/catalogue/part-photo";

/** Photo ids are the first 32 hex characters of a SHA-256 of the bytes. */
export const PHOTO_ID = /^[0-9a-f]{32}$/;

/** A stored photo's bytes, or null when there is no such photo. */
export async function readProductPhoto(id: string) {
  if (!PHOTO_ID.test(id)) return null;
  const [row] = await getDb()
    .select({ mimeType: productPhotos.mimeType, base64: sql<string>`encode(${productPhotos.data}, 'base64')` })
    .from(productPhotos)
    .where(eq(productPhotos.id, id));
  if (!row) return null;
  return { mimeType: row.mimeType, bytes: Buffer.from(row.base64, "base64") };
}

/** Other parts of the same family (3943B, 3943G… for 3943A) that have no photo yet. */
export async function relatedPartsWithoutPhoto(productId: number, partNo: string) {
  const family = partFamily(partNo);
  if (!family) return [];
  return getDb()
    .select({ id: products.id, partNo: products.partNo })
    .from(products)
    .where(
      and(
        ne(products.id, productId),
        isNull(products.photo),
        sql`substring(${products.partNo} from '^[0-9]+') = ${family}`,
      ),
    )
    .orderBy(asc(products.partNo))
    .limit(RELATED_PARTS_MAX);
}

/**
 * Stores the photo once (its id is a hash of the bytes) and puts it on the part.
 * `relatedIds` are family parts to share it with; only those still without a
 * photo are changed, so nobody's photo is ever replaced by accident.
 */
export async function setPartPhoto(productId: number, bytes: Buffer, mimeType: string, relatedIds: number[]) {
  const id = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  const db = getDb();
  const [part] = await db.select({ partNo: products.partNo }).from(products).where(eq(products.id, productId));
  if (!part) return null;
  const family = partFamily(part.partNo);
  const others = family ? relatedIds.filter((n) => n !== productId).slice(0, RELATED_PARTS_MAX) : [];
  const [, mine, shared] = await db.batch([
    db
      .insert(productPhotos)
      .values({ id, mimeType, data: sql`decode(${bytes.toString("base64")}, 'base64')` })
      .onConflictDoNothing(),
    db.update(products).set({ photo: id }).where(eq(products.id, productId)).returning({ id: products.id }),
    db
      .update(products)
      .set({ photo: id })
      .where(
        and(
          inArray(products.id, others.length ? others : [0]),
          isNull(products.photo),
          sql`substring(${products.partNo} from '^[0-9]+') = ${family ?? ""}`,
        ),
      )
      .returning({ id: products.id }),
  ]);
  return mine.length ? { photo: id, shared: shared.length } : null;
}

/** Takes the photo off one part. The picture stays stored while other parts use it. */
export async function clearPartPhoto(productId: number) {
  const db = getDb();
  const [row] = await db
    .update(products)
    .set({ photo: null })
    .where(eq(products.id, productId))
    .returning({ id: products.id });
  return row != null;
}

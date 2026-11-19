import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { productPhotos } from "@/db/schema";

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

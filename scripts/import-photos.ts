// Loads part photos into the database from a folder holding `photos.json`
// ({ "<part no>": "<file name>" }) and the image files it names.
//
// Safe by default:
//   - Preview unless --apply is given.
//   - A part that already has a photo keeps it, unless --replace is given.
//   - Each picture is stored once, keyed by a hash of its bytes, so running it
//     again adds nothing new.
//
// Usage:
//   pnpm tsx --env-file=.env.local scripts/import-photos.ts <folder>            # preview
//   pnpm tsx --env-file=.env.local scripts/import-photos.ts <folder> --apply    # write

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { parseArgs } from "node:util";

import { Pool } from "@neondatabase/serverless";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "../src/db/schema";

const { products, productPhotos } = schema;
const TYPES: Record<string, string> = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
const MAX_BYTES = 300_000;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { apply: { type: "boolean", default: false }, replace: { type: "boolean", default: false } },
  });
  const folder = positionals[0];
  if (!folder) throw new Error("Give the folder that holds photos.json.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

  const manifest = JSON.parse(readFileSync(join(folder, "photos.json"), "utf8")) as Record<string, string>;
  const files = new Map<string, { id: string; mimeType: string; data: Buffer }>();
  for (const file of new Set(Object.values(manifest))) {
    const mimeType = TYPES[extname(file).toLowerCase()];
    if (!mimeType || file.includes("/") || file.includes("\\")) throw new Error(`Not a photo file: ${file}`);
    const data = readFileSync(join(folder, file));
    if (data.length > MAX_BYTES) throw new Error(`${file} is over ${MAX_BYTES / 1000} KB.`);
    files.set(file, { id: createHash("sha256").update(data).digest("hex").slice(0, 32), mimeType, data });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });
  try {
    const parts = await db
      .select({ id: products.id, partNo: products.partNo, photo: products.photo })
      .from(products)
      .where(inArray(products.partNo, Object.keys(manifest)));
    const unknown = Object.keys(manifest).filter((no) => !parts.some((p) => p.partNo === no));
    const keep = parts.filter((p) => p.photo != null && !values.replace);
    const todo = parts.filter((p) => !keep.includes(p) && p.photo !== files.get(manifest[p.partNo])!.id);
    const used = new Set(todo.map((p) => manifest[p.partNo]));

    console.log(values.apply ? "Applying…" : "Preview only (nothing saved). Add --apply to save.");
    console.log(`  Photos in folder: ${files.size} (${used.size} needed)`);
    console.log(`  Parts to get a photo: ${todo.length}`);
    console.log(`  Parts that keep their own photo: ${keep.length}`);
    console.log(`  Part numbers not in the catalogue: ${unknown.length}${unknown.length ? ` (${unknown.slice(0, 10).join(", ")}${unknown.length > 10 ? ", …" : ""})` : ""}`);
    if (!values.apply) return;

    await db.transaction(async (tx) => {
      for (const file of used) {
        const f = files.get(file)!;
        await tx
          .insert(productPhotos)
          .values({ id: f.id, mimeType: f.mimeType, data: sql`decode(${f.data.toString("base64")}, 'base64')` })
          .onConflictDoNothing();
      }
      for (const p of todo) {
        const id = files.get(manifest[p.partNo])!.id;
        await tx
          .update(products)
          .set({ photo: id })
          .where(values.replace ? eq(products.id, p.id) : and(eq(products.id, p.id), isNull(products.photo)));
      }
    });
    console.log("Done.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

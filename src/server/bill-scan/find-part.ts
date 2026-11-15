import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { products } from "@/db/schema";
import { partKey } from "@/lib/bills/scan";

/** Active part ids by part number key, for exact matches. */
export async function partKeys(): Promise<Map<string, number[]>> {
  const parts = await getDb().select({ id: products.id, partNo: products.partNo }).from(products).where(eq(products.active, true));
  const byKey = new Map<string, number[]>();
  for (const p of parts) {
    const k = partKey(p.partNo);
    if (k) byKey.set(k, [...(byKey.get(k) ?? []), p.id]);
  }
  return byKey;
}

export type FoundPart = { id: number; sure: boolean } | { choices: string[] } | null;

/**
 * The one active part a written row means: the same part number, else a search with
 * exactly one hit, else the one hit whose name has every word written. When several
 * fit, their part numbers are returned so the user can pick.
 */
export async function findPart(
  line: { partNo: string | null; description: string | null },
  byKey: Map<string, number[]>,
  search: (query: string) => Promise<{ id: number; partNo: string; description: string }[]>,
): Promise<FoundPart> {
  const key = line.partNo ? partKey(line.partNo) : "";
  const exact = key ? byKey.get(key) : undefined;
  if (exact?.length === 1) return { id: exact[0], sure: true };
  const query = (line.partNo ?? line.description ?? "").trim();
  if (query.length < 3) return null;
  const found = await search(query);
  if (found.length === 1) return { id: found[0].id, sure: false };
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  const full = found.filter((f) => {
    const name = `${f.partNo} ${f.description}`.toLowerCase();
    return words.every((w) => name.includes(w));
  });
  if (full.length === 1) return { id: full[0].id, sure: false };
  const close = full.length ? full : found;
  return close.length ? { choices: close.map((f) => f.partNo) } : null;
}

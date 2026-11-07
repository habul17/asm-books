import "server-only";

import { asc, eq, isNull } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { priceLists, settings } from "@/db/schema";
import { readBusiness, type BusinessSettings } from "@/lib/settings/business";
import { requireUser } from "@/server/auth";

type Db = Pick<ReturnType<typeof getDb>, "select">;

/** Business details without an auth check. Only for code that has already checked the user. */
export async function loadBusiness(db: Db = getDb()): Promise<BusinessSettings> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "business"));
  return readBusiness(row?.value);
}

export async function getBusiness(): Promise<BusinessSettings> {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  return loadBusiness();
}

/** Price lists that can be chosen as the default. */
export async function getPriceListOptions() {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  return getDb()
    .select({ id: priceLists.id, name: priceLists.name, enabled: priceLists.enabled })
    .from(priceLists)
    .where(isNull(priceLists.deletedAt))
    .orderBy(asc(priceLists.sort), asc(priceLists.id));
}

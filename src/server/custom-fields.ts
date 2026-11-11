import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { customFields } from "@/db/schema";
import type { CustomFieldDef, CustomFieldEntity } from "@/lib/custom-fields";
import { connection } from "next/server";

import { requireUser } from "./auth";

type Db = Pick<ReturnType<typeof getDb>, "select">;

/** Custom fields without an auth check. Only for code that has already checked the user. */
export async function loadCustomFields(entity: CustomFieldEntity, db: Db = getDb()): Promise<CustomFieldDef[]> {
  return db
    .select({ id: customFields.id, label: customFields.label, type: customFields.type, active: customFields.active })
    .from(customFields)
    .where(eq(customFields.entity, entity))
    .orderBy(asc(customFields.sort), asc(customFields.id));
}

/** One record type's custom fields, switched-off ones included, in the order they are shown. */
export async function getCustomFields(entity: CustomFieldEntity): Promise<CustomFieldDef[]> {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  return loadCustomFields(entity);
}

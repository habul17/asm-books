"use server";

import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { priceListFolders, priceListItems, priceLists, products } from "@/db/schema";
import { priceListsHref } from "@/lib/price-lists/href";
import { isOwner, requireUser } from "@/server/auth";

const OWNER_ONLY = "Only the owner can change price lists.";

async function signedInAsOwner() {
  return isOwner(await requireUser());
}
import {
  createsFolderCycle,
  firstError,
  folderSchema,
  manualPriceSchema,
  priceListSchema,
} from "@/lib/price-lists/validation";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();
const nullableIdSchema = idSchema.nullable();

const FAILED = "Could not save. Please try again.";

async function folderExists(id: number | null) {
  if (id == null) return true;
  const rows = await getDb()
    .select({ id: priceListFolders.id })
    .from(priceListFolders)
    .where(eq(priceListFolders.id, id));
  return rows.length > 0;
}

async function listExists(id: number) {
  const rows = await getDb()
    .select({ id: priceLists.id })
    .from(priceLists)
    .where(and(eq(priceLists.id, id), isNull(priceLists.deletedAt)));
  return rows.length > 0;
}

function logError(action: string, err: unknown) {
  console.error(`[price-lists] ${action} failed:`, err instanceof Error ? err.message : err);
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function createFolder(parentId: number | null): Promise<ActionState> {
  if (!(await signedInAsOwner())) return { error: OWNER_ONLY };
  if (!nullableIdSchema.safeParse(parentId).success) return { error: "Invalid folder" };
  if (!(await folderExists(parentId))) return { error: "Parent folder not found" };

  let id: number;
  try {
    const [row] = await getDb()
      .insert(priceListFolders)
      .values({ name: "New folder", parentId })
      .returning({ id: priceListFolders.id });
    id = row.id;
  } catch (err) {
    logError("createFolder", err);
    return { error: FAILED };
  }
  redirect(priceListsHref({ folder: id, rename: true }));
}

export async function updateFolder(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await signedInAsOwner())) return { error: OWNER_ONLY };
  if (!idSchema.safeParse(id).success) return { error: "Invalid folder" };
  const parsed = folderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, parentId } = parsed.data;

  try {
    const db = getDb();
    const folders = await db
      .select({ id: priceListFolders.id, parentId: priceListFolders.parentId })
      .from(priceListFolders);
    const parents = new Map(folders.map((f) => [f.id, f.parentId]));
    if (!parents.has(id)) return { error: "Folder not found" };
    if (parentId != null && !parents.has(parentId)) return { error: "Parent folder not found" };
    if (createsFolderCycle(id, parentId, (f) => parents.get(f))) {
      return { error: "A folder cannot be moved inside itself" };
    }

    await db.update(priceListFolders).set({ name, parentId }).where(eq(priceListFolders.id, id));
  } catch (err) {
    logError("updateFolder", err);
    return { error: FAILED };
  }
  refresh();
  return { ok: true };
}

/** Only empty folders can be deleted, so nothing is lost by accident. */
export async function deleteFolder(id: number): Promise<ActionState> {
  if (!(await signedInAsOwner())) return { error: OWNER_ONLY };
  if (!idSchema.safeParse(id).success) return { error: "Invalid folder" };
  const db = getDb();

  try {
    const [[sub], [lists]] = await db.batch([
      db.select({ n: count() }).from(priceListFolders).where(eq(priceListFolders.parentId, id)),
      db
        .select({ n: count() })
        .from(priceLists)
        .where(and(eq(priceLists.folderId, id), isNull(priceLists.deletedAt))),
    ]);
    if (sub.n > 0 || lists.n > 0) {
      return { error: "This folder is not empty. Move or delete what is inside first." };
    }

    // Deleted (hidden) lists may still point at the folder; move them to the top level.
    const [, deleted] = await db.batch([
      db
        .update(priceLists)
        .set({ folderId: null })
        .where(and(eq(priceLists.folderId, id), isNotNull(priceLists.deletedAt))),
      db.delete(priceListFolders).where(eq(priceListFolders.id, id)).returning({ id: priceListFolders.id }),
    ]);
    if (deleted.length === 0) return { error: "Folder not found" };
  } catch (err) {
    logError("deleteFolder", err);
    return { error: FAILED };
  }
  redirect(priceListsHref());
}

// ---------------------------------------------------------------------------
// Price lists
// ---------------------------------------------------------------------------

export async function createPriceList(folderId: number | null): Promise<ActionState> {
  if (!(await signedInAsOwner())) return { error: OWNER_ONLY };
  if (!nullableIdSchema.safeParse(folderId).success) return { error: "Invalid folder" };
  if (!(await folderExists(folderId))) return { error: "Folder not found" };

  let id: number;
  try {
    const [row] = await getDb()
      .insert(priceLists)
      .values({ name: "New price list", folderId, base: "purchase", adjustType: "markup", adjustPct: 0 })
      .returning({ id: priceLists.id });
    id = row.id;
  } catch (err) {
    logError("createPriceList", err);
    return { error: FAILED };
  }
  redirect(priceListsHref({ list: id, rename: true }));
}

export async function updatePriceList(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await signedInAsOwner())) return { error: OWNER_ONLY };
  if (!idSchema.safeParse(id).success) return { error: "Invalid price list" };
  const parsed = priceListSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  try {
    if (!(await folderExists(parsed.data.folderId))) return { error: "Folder not found" };
    const updated = await getDb()
      .update(priceLists)
      .set(parsed.data)
      .where(and(eq(priceLists.id, id), isNull(priceLists.deletedAt)))
      .returning({ id: priceLists.id });
    if (updated.length === 0) return { error: "Price list not found" };
  } catch (err) {
    logError("updatePriceList", err);
    return { error: FAILED };
  }
  refresh();
  return { ok: true };
}

/** Soft delete: the list is hidden but kept, because old invoices refer to it. */
export async function deletePriceList(id: number): Promise<ActionState> {
  if (!(await signedInAsOwner())) return { error: OWNER_ONLY };
  if (!idSchema.safeParse(id).success) return { error: "Invalid price list" };
  try {
    const deleted = await getDb()
      .update(priceLists)
      .set({ deletedAt: new Date() })
      .where(and(eq(priceLists.id, id), isNull(priceLists.deletedAt)))
      .returning({ id: priceLists.id });
    if (deleted.length === 0) return { error: "Price list not found" };
  } catch (err) {
    logError("deletePriceList", err);
    return { error: FAILED };
  }
  redirect(priceListsHref());
}

// ---------------------------------------------------------------------------
// Manual prices
// ---------------------------------------------------------------------------

/** Sets a fixed price for one product in one list; an empty value removes it. */
export async function setManualPrice(listId: number, productId: number, value: string): Promise<ActionState> {
  if (!(await signedInAsOwner())) return { error: OWNER_ONLY };
  if (!idSchema.safeParse(listId).success || !idSchema.safeParse(productId).success) {
    return { error: "Invalid product" };
  }
  const parsed = manualPriceSchema.safeParse(value);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const price = parsed.data;
  const db = getDb();

  try {
    if (!(await listExists(listId))) return { error: "Price list not found" };
    if (price == null) {
      await db
        .delete(priceListItems)
        .where(and(eq(priceListItems.priceListId, listId), eq(priceListItems.productId, productId)));
    } else {
      const product = await db.select({ id: products.id }).from(products).where(eq(products.id, productId));
      if (product.length === 0) return { error: "Product not found" };
      await db
        .insert(priceListItems)
        .values({ priceListId: listId, productId, manualPrice: price })
        .onConflictDoUpdate({
          target: [priceListItems.priceListId, priceListItems.productId],
          set: { manualPrice: price, updatedAt: new Date() },
        });
    }
  } catch (err) {
    logError("setManualPrice", err);
    return { error: FAILED };
  }
  refresh();
  return { ok: true };
}

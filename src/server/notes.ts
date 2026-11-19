import "server-only";

import { and, asc, count, desc, eq, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { noteFiles, noteFolders, noteLocks, notes } from "@/db/schema";
import { DELETED_DAYS, type FolderKey, NOTE_FILE_ID, type NoteNode } from "@/lib/notes/notes";
import { requireUser } from "@/server/auth";

const LIST_LIMIT = 1000;

/** Removes notes that have been in Recently Deleted for more than 30 days. */
async function purgeOld(userId: number) {
  await getDb()
    .delete(notes)
    .where(
      and(
        eq(notes.userId, userId),
        isNotNull(notes.deletedAt),
        lt(notes.deletedAt, sql`now() - make_interval(days => ${DELETED_DAYS})`),
      ),
    );
}

/** The folders column: built-in folders with counts, then the person's own folders. */
async function loadFolders(userId: number) {
  const db = getDb();
  const [own, counts] = await Promise.all([
    db
      .select({ id: noteFolders.id, name: noteFolders.name })
      .from(noteFolders)
      .where(eq(noteFolders.userId, userId))
      .orderBy(asc(sql`lower(${noteFolders.name})`)),
    db
      .select({ folderId: notes.folderId, deleted: sql<boolean>`${notes.deletedAt} IS NOT NULL`, n: count() })
      .from(notes)
      .where(eq(notes.userId, userId))
      .groupBy(notes.folderId, sql`${notes.deletedAt} IS NOT NULL`),
  ]);
  const live = counts.filter((c) => !c.deleted);
  const of = (id: number | null) => live.find((c) => c.folderId === id)?.n ?? 0;
  return {
    all: live.reduce((s, c) => s + c.n, 0),
    notes: of(null),
    deleted: counts.filter((c) => c.deleted).reduce((s, c) => s + c.n, 0),
    folders: own.map((f) => ({ ...f, count: of(f.id) })),
  };
}

export type NoteFolders = Awaited<ReturnType<typeof loadFolders>>;

const listColumns = {
  id: notes.id,
  folderId: notes.folderId,
  title: notes.title,
  preview: notes.preview,
  pinned: notes.pinned,
  locked: notes.locked,
  editedAt: notes.editedAt,
  deletedAt: notes.deletedAt,
};

/** The notes in one folder, or the matches for a search across all notes. */
async function loadList(userId: number, folder: FolderKey, query: string) {
  const mine = eq(notes.userId, userId);
  let where;
  if (query) {
    const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where = and(mine, isNull(notes.deletedAt), or(ilike(notes.title, like), ilike(notes.searchText, like)));
  } else if (folder === "deleted") where = and(mine, isNotNull(notes.deletedAt));
  else if (folder === "all") where = and(mine, isNull(notes.deletedAt));
  else if (folder === "notes") where = and(mine, isNull(notes.deletedAt), isNull(notes.folderId));
  else where = and(mine, isNull(notes.deletedAt), eq(notes.folderId, folder));
  return getDb()
    .select(listColumns)
    .from(notes)
    .where(where)
    .orderBy(desc(notes.pinned), desc(notes.editedAt), desc(notes.id))
    .limit(LIST_LIMIT);
}

export type NoteListItem = Awaited<ReturnType<typeof loadList>>[number];

async function loadNote(userId: number, id: number) {
  const [row] = await getDb()
    .select({
      id: notes.id,
      folderId: notes.folderId,
      title: notes.title,
      body: notes.body,
      pinned: notes.pinned,
      locked: notes.locked,
      cipher: notes.cipher,
      version: notes.version,
      editedAt: notes.editedAt,
      deletedAt: notes.deletedAt,
    })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));
  return row ? { ...row, body: (row.body as NoteNode | null) ?? null } : null;
}

export type OpenNote = NonNullable<Awaited<ReturnType<typeof loadNote>>>;

/** The lock settings the browser needs to turn a password into the key. Never the key itself. */
async function loadLock(userId: number) {
  const [row] = await getDb()
    .select({ salt: noteLocks.salt, iterations: noteLocks.iterations, check: noteLocks.check, hint: noteLocks.hint })
    .from(noteLocks)
    .where(eq(noteLocks.userId, userId));
  return row ?? null;
}

export type NoteLock = Awaited<ReturnType<typeof loadLock>>;

/** Everything the Notes screen shows. Every note belongs to the person signed in, and only they see it. */
export async function notesScreen(folder: FolderKey, noteId: number | null, query: string) {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  await purgeOld(user.id);
  const [folders, list, note, lock] = await Promise.all([
    loadFolders(user.id),
    loadList(user.id, folder, query),
    noteId ? loadNote(user.id, noteId) : null,
    loadLock(user.id),
  ]);
  const folderName =
    folder === "all"
      ? "All Notes"
      : folder === "notes"
        ? "Notes"
        : folder === "deleted"
          ? "Recently Deleted"
          : (folders.folders.find((f) => f.id === folder)?.name ?? null);
  return { folders, folderName, list, note, lock };
}

/** A note file's bytes, only for the person who owns it. */
export async function readNoteFile(id: string, userId: number) {
  if (!NOTE_FILE_ID.test(id)) return null;
  const [row] = await getDb()
    .select({
      name: noteFiles.name,
      mimeType: noteFiles.mimeType,
      encrypted: noteFiles.encrypted,
      base64: sql<string>`encode(${noteFiles.data}, 'base64')`,
    })
    .from(noteFiles)
    .where(and(eq(noteFiles.id, id), eq(noteFiles.userId, userId)));
  if (!row) return null;
  return { ...row, bytes: Buffer.from(row.base64, "base64") };
}

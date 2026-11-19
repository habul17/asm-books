import "server-only";

import { randomBytes } from "node:crypto";

import { and, eq, isNotNull, isNull, ne, notInArray, or, sql } from "drizzle-orm";

import { getDb, withTransaction } from "@/db";
import { noteFiles, noteFolders, noteLocks, notes } from "@/db/schema";
import { formatBytes } from "@/lib/documents/documents";
import {
  FOLDER_NAME_MAX,
  isSafeNoteBody,
  NOTE_BODY_MAX,
  NOTE_FILE_MAX,
  NOTE_STORAGE_LIMIT,
  noteFileIds,
  noteSummary,
} from "@/lib/notes/notes";

/** A problem the person can fix; the message is safe to show. */
export class NoteError extends Error {}

/** The note was saved from another device since this one opened it. */
export class NoteConflictError extends NoteError {
  constructor() {
    super("This note was changed on another device. Reload to see the latest copy.");
  }
}

/** Key for the lock that lets one upload at a time check the storage limit. */
const NOTE_STORAGE_LOCK = 72_810_020;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
/** IV (12 bytes) + at least the 16-byte tag, as base64. */
const MIN_CIPHER = 38;

const own = (userId: number, id: number) => and(eq(notes.id, id), eq(notes.userId, userId));

async function checkFolder(userId: number, folderId: number | null) {
  if (folderId == null) return;
  const [f] = await getDb()
    .select({ id: noteFolders.id })
    .from(noteFolders)
    .where(and(eq(noteFolders.id, folderId), eq(noteFolders.userId, userId)));
  if (!f) throw new NoteError("That folder no longer exists.");
}

export async function createNote(userId: number, folderId: number | null): Promise<number> {
  await checkFolder(userId, folderId);
  const [{ id }] = await getDb()
    .insert(notes)
    .values({ userId, folderId, body: { type: "doc", content: [{ type: "heading", attrs: { level: 1 } }] } })
    .returning({ id: notes.id });
  return id;
}

/** The note's JSON text, checked for size before it is read and for safety after. */
function checkBody(json: unknown) {
  if (typeof json !== "string") throw new NoteError("This note could not be saved. Please reload and try again.");
  if (json.length > NOTE_BODY_MAX) throw new NoteError("This note is too long. Split it into two notes.");
  let body: unknown;
  try {
    body = JSON.parse(json);
  } catch {
    throw new NoteError("This note could not be saved. Please reload and try again.");
  }
  if (!isSafeNoteBody(body)) throw new NoteError("This note could not be saved. Please reload and try again.");
  return body;
}

function checkCipher(cipher: unknown) {
  if (typeof cipher !== "string" || cipher.length < MIN_CIPHER || cipher.length > NOTE_BODY_MAX * 2 || !BASE64.test(cipher)) {
    throw new NoteError("This note could not be saved. Please reload and try again.");
  }
  return cipher;
}

const cleanTitle = (title: unknown) => (typeof title === "string" ? title.replace(/\s+/g, " ").trim().slice(0, 200) : "");

/** Saves new words. Returns the new version, or throws NoteConflictError if another device saved first. */
export async function saveNoteBody(userId: number, id: number, version: number, body: unknown): Promise<number> {
  const safe = checkBody(body);
  const summary = noteSummary(safe);
  const [row] = await getDb()
    .update(notes)
    .set({ body: safe, ...summary, version: sql`${notes.version} + 1`, editedAt: sql`now()` })
    .where(and(own(userId, id), eq(notes.version, version), eq(notes.locked, false), isNull(notes.deletedAt)))
    .returning({ version: notes.version });
  if (!row) throw await whyNotSaved(userId, id);
  return row.version;
}

/** Saves a locked note: only its title is readable; the rest arrives already encrypted. */
export async function saveLockedNote(userId: number, id: number, version: number, title: unknown, cipher: unknown) {
  const [row] = await getDb()
    .update(notes)
    .set({
      title: cleanTitle(title),
      cipher: checkCipher(cipher),
      version: sql`${notes.version} + 1`,
      editedAt: sql`now()`,
    })
    .where(and(own(userId, id), eq(notes.version, version), eq(notes.locked, true), isNull(notes.deletedAt)))
    .returning({ version: notes.version });
  if (!row) throw await whyNotSaved(userId, id);
  return row.version;
}

async function whyNotSaved(userId: number, id: number) {
  const [n] = await getDb().select({ deletedAt: notes.deletedAt }).from(notes).where(own(userId, id));
  if (!n) return new NoteError("This note no longer exists.");
  if (n.deletedAt) return new NoteError("This note is in Recently Deleted. Recover it to edit.");
  return new NoteConflictError();
}

/**
 * Locks a note. The browser has already encrypted the words and re-sent its
 * photos encrypted; the plain copies of those photos are removed here.
 */
export async function lockNote(userId: number, id: number, version: number, title: unknown, cipher: unknown, fileIds: string[]) {
  const [lock] = await getDb().select({ userId: noteLocks.userId }).from(noteLocks).where(eq(noteLocks.userId, userId));
  if (!lock) throw new NoteError("Set a password for locked notes first.");
  await withTransaction(async (tx) => {
    const [row] = await tx
      .update(notes)
      .set({
        title: cleanTitle(title),
        preview: "",
        searchText: "",
        body: null,
        locked: true,
        cipher: checkCipher(cipher),
        version: sql`${notes.version} + 1`,
      })
      .where(and(own(userId, id), eq(notes.version, version), eq(notes.locked, false), isNull(notes.deletedAt)))
      .returning({ version: notes.version });
    if (!row) throw new NoteConflictError();
    await tx
      .delete(noteFiles)
      .where(
        and(
          eq(noteFiles.noteId, id),
          eq(noteFiles.userId, userId),
          fileIds.length ? or(eq(noteFiles.encrypted, false), notInArray(noteFiles.id, fileIds)) : undefined,
        ),
      );
  });
}

/** Takes the lock off. The browser sends the words decrypted and its photos re-sent in the clear. */
export async function unlockNote(userId: number, id: number, version: number, body: unknown) {
  const safe = checkBody(body);
  const keep = noteFileIds(safe);
  await withTransaction(async (tx) => {
    const [row] = await tx
      .update(notes)
      .set({ body: safe, ...noteSummary(safe), locked: false, cipher: null, version: sql`${notes.version} + 1` })
      .where(and(own(userId, id), eq(notes.version, version), eq(notes.locked, true), isNull(notes.deletedAt)))
      .returning({ version: notes.version });
    if (!row) throw new NoteConflictError();
    await tx
      .delete(noteFiles)
      .where(
        and(
          eq(noteFiles.noteId, id),
          eq(noteFiles.userId, userId),
          keep.length ? or(eq(noteFiles.encrypted, true), notInArray(noteFiles.id, keep)) : undefined,
        ),
      );
  });
}

/** Leaving a note with nothing in it removes it, as in Apple Notes. */
export async function discardEmptyNote(userId: number, id: number) {
  await getDb()
    .delete(notes)
    .where(
      and(
        own(userId, id),
        eq(notes.locked, false),
        eq(notes.title, ""),
        eq(notes.searchText, ""),
        sql`NOT EXISTS (SELECT 1 FROM ${noteFiles} WHERE ${noteFiles.noteId} = ${notes.id})`,
      ),
    );
}

export async function setNotePinned(userId: number, id: number, pinned: boolean) {
  await getDb()
    .update(notes)
    .set({ pinned })
    .where(and(own(userId, id), isNull(notes.deletedAt)));
}

export async function moveNote(userId: number, id: number, folderId: number | null) {
  await checkFolder(userId, folderId);
  const moved = await getDb()
    .update(notes)
    .set({ folderId, deletedAt: null })
    .where(own(userId, id))
    .returning({ id: notes.id });
  if (moved.length === 0) throw new NoteError("This note no longer exists.");
}

/** Moves a note to Recently Deleted, or removes it for good if it is already there. */
export async function deleteNote(userId: number, id: number) {
  const db = getDb();
  const [n] = await db.select({ deletedAt: notes.deletedAt }).from(notes).where(own(userId, id));
  if (!n) return;
  if (n.deletedAt) await db.delete(notes).where(own(userId, id));
  else await db.update(notes).set({ deletedAt: sql`now()`, pinned: false }).where(own(userId, id));
}

export async function recoverNote(userId: number, id: number) {
  await getDb()
    .update(notes)
    .set({ deletedAt: null })
    .where(and(own(userId, id), isNotNull(notes.deletedAt)));
}

export async function emptyRecentlyDeleted(userId: number) {
  await getDb()
    .delete(notes)
    .where(and(eq(notes.userId, userId), isNotNull(notes.deletedAt)));
}

function folderName(name: unknown) {
  const clean = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
  if (!clean) throw new NoteError("Type a folder name.");
  if (clean.length > FOLDER_NAME_MAX) throw new NoteError(`Keep the name under ${FOLDER_NAME_MAX} letters.`);
  if (["notes", "all notes", "recently deleted"].includes(clean.toLowerCase())) throw new NoteError("That name is taken. Choose another.");
  return clean;
}

async function nameFree(userId: number, name: string, exceptId?: number) {
  const [taken] = await getDb()
    .select({ id: noteFolders.id })
    .from(noteFolders)
    .where(
      and(
        eq(noteFolders.userId, userId),
        sql`lower(${noteFolders.name}) = lower(${name})`,
        exceptId ? ne(noteFolders.id, exceptId) : undefined,
      ),
    );
  if (taken) throw new NoteError("You already have a folder with that name.");
}

export async function createFolder(userId: number, name: unknown): Promise<number> {
  const clean = folderName(name);
  await nameFree(userId, clean);
  const [{ id }] = await getDb().insert(noteFolders).values({ userId, name: clean }).returning({ id: noteFolders.id });
  return id;
}

export async function renameFolder(userId: number, id: number, name: unknown) {
  const clean = folderName(name);
  await nameFree(userId, clean, id);
  const done = await getDb()
    .update(noteFolders)
    .set({ name: clean })
    .where(and(eq(noteFolders.id, id), eq(noteFolders.userId, userId)))
    .returning({ id: noteFolders.id });
  if (done.length === 0) throw new NoteError("That folder no longer exists.");
}

/** Deletes a folder; its notes go to Recently Deleted, as in Apple Notes. */
export async function deleteFolder(userId: number, id: number) {
  await withTransaction(async (tx) => {
    await tx
      .update(notes)
      .set({ deletedAt: sql`now()`, pinned: false, folderId: null })
      .where(and(eq(notes.userId, userId), eq(notes.folderId, id), isNull(notes.deletedAt)));
    await tx.delete(noteFolders).where(and(eq(noteFolders.id, id), eq(noteFolders.userId, userId)));
  });
}

/** Keeps a photo or file for a note. Encrypted files arrive as opaque bytes from a locked note. */
export async function addNoteFile(
  userId: number,
  noteId: number,
  file: { name: string; mimeType: string; bytes: Buffer; encrypted: boolean },
): Promise<string> {
  if (file.bytes.length === 0) throw new NoteError("That file is empty.");
  if (file.bytes.length > NOTE_FILE_MAX) throw new NoteError(`Files can be up to ${formatBytes(NOTE_FILE_MAX)}.`);
  const id = randomBytes(16).toString("hex");
  await withTransaction(async (tx) => {
    const [n] = await tx
      .select({ locked: notes.locked })
      .from(notes)
      .where(and(own(userId, noteId), isNull(notes.deletedAt)));
    if (!n) throw new NoteError("This note no longer exists.");
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${NOTE_STORAGE_LOCK})`);
    const [{ used }] = await tx
      .select({ used: sql<number>`coalesce(sum(${noteFiles.size}), 0)`.mapWith(Number) })
      .from(noteFiles)
      .where(eq(noteFiles.userId, userId));
    if (used + file.bytes.length > NOTE_STORAGE_LIMIT) {
      throw new NoteError(`Notes storage is full (${formatBytes(NOTE_STORAGE_LIMIT)}). Delete notes with big photos, then try again.`);
    }
    await tx.insert(noteFiles).values({
      id,
      userId,
      noteId,
      // A locked note's file name and type are kept inside the encrypted note instead.
      name: file.encrypted ? "locked" : file.name.slice(0, 200) || "file",
      mimeType: file.encrypted ? "application/octet-stream" : file.mimeType,
      size: file.bytes.length,
      encrypted: file.encrypted,
      data: sql`decode(${file.bytes.toString("base64")}, 'base64')` as unknown as Buffer,
    });
  });
  return id;
}

export async function setNoteLock(userId: number, input: { salt: unknown; iterations: unknown; check: unknown; hint: unknown }) {
  const { salt, iterations, check, hint } = input;
  if (typeof salt !== "string" || !BASE64.test(salt) || salt.length < 16 || salt.length > 64) throw new NoteError("Please try again.");
  if (typeof iterations !== "number" || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 5_000_000) {
    throw new NoteError("Please try again.");
  }
  if (typeof check !== "string" || !BASE64.test(check) || check.length > 200) throw new NoteError("Please try again.");
  const cleanHint = typeof hint === "string" ? hint.trim().slice(0, 100) || null : null;
  const added = await getDb()
    .insert(noteLocks)
    .values({ userId, salt, iterations, check, hint: cleanHint })
    .onConflictDoNothing()
    .returning({ userId: noteLocks.userId });
  if (added.length === 0) throw new NoteError("A password for locked notes is already set.");
}

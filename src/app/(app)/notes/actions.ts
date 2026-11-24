"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { NOTE_FILE_ID, NOTE_FILE_MAX } from "@/lib/notes/notes";
import { requireUser } from "@/server/auth";
import {
  addNoteFile,
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  discardEmptyNote,
  emptyRecentlyDeleted,
  lockNote,
  LOST_SAVES_MAX,
  moveNote,
  NoteConflictError,
  NoteError,
  recoverNote,
  renameFolder,
  saveLockedNote,
  saveNoteBody,
  setNoteLock,
  setNotePinned,
  unlockNote,
} from "@/server/note-writes";

export interface NoteResult<T = undefined> {
  ok?: boolean;
  value?: T;
  error?: string;
  /** Another device saved this note first. */
  conflict?: boolean;
}

const idSchema = z.number().int().positive().max(2_147_483_647);
const versionSchema = z.number().int().positive();
const folderSchema = idSchema.nullable();
const fileIdsSchema = z.array(z.string().regex(NOTE_FILE_ID)).max(500);

async function run<T>(action: string, fn: (userId: number) => Promise<T>, { reload = true } = {}): Promise<NoteResult<T>> {
  const user = await requireUser();
  try {
    const value = await fn(user.id);
    if (reload) refresh();
    return { ok: true, value };
  } catch (err) {
    if (err instanceof NoteConflictError) return { error: err.message, conflict: true };
    if (err instanceof NoteError) return { error: err.message };
    console.error(`[notes] ${action} failed:`, err instanceof Error ? err.message : err);
    return { error: "Could not save. Check the internet and try again." };
  }
}

const bad = (): NoteResult<never> => ({ error: "This note no longer exists." });

export async function newNoteAction(folderId: number | null) {
  if (!folderSchema.safeParse(folderId).success) return bad();
  return run("new", (u) => createNote(u, folderId), { reload: false });
}

/** Earlier saves from this phone whose answer never arrived; see saveNoteBody. */
const lostSchema = z.array(z.string()).max(LOST_SAVES_MAX);

/** `body` is the note as JSON text. */
export async function saveNoteAction(id: number, version: number, body: string, lost: string[] = []) {
  if (!idSchema.safeParse(id).success || !versionSchema.safeParse(version).success || !lostSchema.safeParse(lost).success) return bad();
  return run("save", (u) => saveNoteBody(u, id, version, body, lost), { reload: false });
}

export async function saveLockedNoteAction(id: number, version: number, title: string, cipher: string, lost: string[] = []) {
  if (!idSchema.safeParse(id).success || !versionSchema.safeParse(version).success || !lostSchema.safeParse(lost).success) return bad();
  return run("save locked", (u) => saveLockedNote(u, id, version, title, cipher, lost), { reload: false });
}

export async function lockNoteAction(id: number, version: number, title: string, cipher: string, fileIds: string[]) {
  if (!idSchema.safeParse(id).success || !versionSchema.safeParse(version).success || !fileIdsSchema.safeParse(fileIds).success) {
    return bad();
  }
  return run("lock", (u) => lockNote(u, id, version, title, cipher, fileIds));
}

export async function unlockNoteAction(id: number, version: number, body: string) {
  if (!idSchema.safeParse(id).success || !versionSchema.safeParse(version).success) return bad();
  return run("unlock", (u) => unlockNote(u, id, version, body));
}

export async function discardEmptyNoteAction(id: number) {
  if (!idSchema.safeParse(id).success) return bad();
  return run("discard", (u) => discardEmptyNote(u, id));
}

export async function pinNoteAction(id: number, pinned: boolean) {
  if (!idSchema.safeParse(id).success || typeof pinned !== "boolean") return bad();
  return run("pin", (u) => setNotePinned(u, id, pinned));
}

export async function moveNoteAction(id: number, folderId: number | null) {
  if (!idSchema.safeParse(id).success || !folderSchema.safeParse(folderId).success) return bad();
  return run("move", (u) => moveNote(u, id, folderId));
}

export async function deleteNoteAction(id: number) {
  if (!idSchema.safeParse(id).success) return bad();
  return run("delete", (u) => deleteNote(u, id));
}

export async function recoverNoteAction(id: number) {
  if (!idSchema.safeParse(id).success) return bad();
  return run("recover", (u) => recoverNote(u, id));
}

export async function emptyDeletedAction() {
  return run("empty deleted", (u) => emptyRecentlyDeleted(u));
}

export async function createFolderAction(name: string) {
  return run("new folder", (u) => createFolder(u, name));
}

export async function renameFolderAction(id: number, name: string) {
  if (!idSchema.safeParse(id).success) return { error: "That folder no longer exists." };
  return run("rename folder", (u) => renameFolder(u, id, name));
}

export async function deleteFolderAction(id: number) {
  if (!idSchema.safeParse(id).success) return { error: "That folder no longer exists." };
  return run("delete folder", (u) => deleteFolder(u, id));
}

/** Keeps a photo or file dropped into a note. Returns the file's id for the editor. */
export async function uploadNoteFileAction(noteId: number, formData: FormData) {
  if (!idSchema.safeParse(noteId).success) return bad();
  const file = formData.get("file");
  const encrypted = formData.get("encrypted") === "1";
  if (!(file instanceof File)) return { error: "Choose a file." } as NoteResult<string>;
  if (file.size > NOTE_FILE_MAX) return { error: "Files can be up to 4 MB." } as NoteResult<string>;
  const mimeType = encrypted ? "application/octet-stream" : file.type || "application/octet-stream";
  const bytes = Buffer.from(await file.arrayBuffer());
  return run("upload", (u) => addNoteFile(u, noteId, { name: file.name, mimeType, bytes, encrypted }), { reload: false });
}

export async function setNoteLockAction(input: { salt: string; iterations: number; check: string; hint: string }) {
  return run("set lock", (u) => setNoteLock(u, input));
}

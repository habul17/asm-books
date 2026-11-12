"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  DOCUMENT_MAX_BYTES,
  isDocumentFolder,
  parseDocumentDetails,
  parseDocumentLink,
  sniffMimeType,
  titleFromFileName,
} from "@/lib/documents/documents";
import { isOwner, requireUser } from "@/server/auth";
import { createDocument, deleteDocument, DocumentInputError, updateDocument } from "@/server/document-writes";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof DocumentInputError) return { error: err.message };
  console.error(`[documents] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/**
 * Stores one uploaded photo or PDF. The form carries the file, its original
 * name, the folder and, optionally, the bill or expense it belongs to.
 */
export async function uploadDocument(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo or PDF." };
  if (file.size > DOCUMENT_MAX_BYTES) return { error: "This file is too big. Use a file under 4 MB." };
  const bytes = Buffer.from(await file.arrayBuffer());
  // The type is read from the file itself; the name and the browser's claim are not trusted.
  const mimeType = sniffMimeType(bytes);
  if (!mimeType) return { error: "Only photos (JPG, PNG) and PDF files can be kept here." };

  const folder = String(formData.get("folder") ?? "");
  const name = String(formData.get("name") ?? "") || file.name;
  try {
    await createDocument(
      {
        title: titleFromFileName(name),
        folder: isDocumentFolder(folder) ? folder : "other",
        ownerOnly: formData.get("ownerOnly") === "on",
        link: parseDocumentLink(formData),
        mimeType,
        bytes,
      },
      user,
    );
  } catch (err) {
    return failure("upload", err);
  }
  refresh();
  return { ok: true };
}

export async function saveDocumentDetails(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Document not found." };
  const parsed = parseDocumentDetails(formData);
  if (parsed.error !== undefined) return { error: parsed.error };
  try {
    await updateDocument(id, parsed.value, user);
  } catch (err) {
    return failure("save", err);
  }
  refresh();
  return { ok: true };
}

/** Owner only: removes a document for good, then goes back to the list. */
export async function deleteDocumentAction(id: number): Promise<ActionState> {
  const user = await requireUser();
  if (!isOwner(user)) return { error: "Only the owner can delete. Please ask the owner." };
  if (!idSchema.safeParse(id).success) return { error: "Document not found." };
  try {
    await deleteDocument(id);
  } catch (err) {
    return failure("delete", err);
  }
  redirect("/documents");
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { NotesScreen, type NotesView } from "@/components/notes/notes-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { folderHref, parseFolderKey } from "@/lib/notes/notes";
import { notesScreen } from "@/server/notes";

export const metadata: Metadata = { title: "Notes" };

/**
 * Notes, laid out like Apple Notes:
 *   /notes              folders (on a phone; a computer also shows the Notes folder)
 *   /notes/<folder>     the notes in a folder: all, notes, deleted or a folder id
 *   /notes/<folder>/<id> one note open
 */
async function Screen({ params, searchParams }: PageProps<"/notes/[[...slug]]">) {
  const { slug = [] } = await params;
  const { q } = await searchParams;
  if (slug.length > 2) notFound();
  const folderKey = slug.length === 0 ? "notes" : parseFolderKey(slug[0]);
  if (folderKey == null) notFound();
  const noteId = slug[1] !== undefined ? (/^[1-9]\d{0,9}$/.test(slug[1]) ? Number(slug[1]) : NaN) : null;
  if (Number.isNaN(noteId)) notFound();
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";

  const data = await notesScreen(folderKey, noteId, query);
  if (data.folderName == null) redirect(folderHref("notes"));
  if (noteId != null && !data.note) redirect(folderHref(folderKey));
  const view: NotesView = slug.length === 0 ? "folders" : noteId == null ? "list" : "note";

  return (
    <NotesScreen
      view={view}
      folderKey={folderKey}
      folderName={data.folderName}
      folders={data.folders}
      list={data.list}
      note={data.note}
      lock={data.lock}
      query={query}
    />
  );
}

export default function NotesPage(props: PageProps<"/notes/[[...slug]]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[70svh] rounded-xl" />}>
      <Screen {...props} />
    </Suspense>
  );
}

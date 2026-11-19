import { NoteKeyProvider } from "@/components/notes/note-key";

/** Keeps the locked-notes key in memory while moving between notes. */
export default function NotesLayout({ children }: LayoutProps<"/notes">) {
  return <NoteKeyProvider>{children}</NoteKeyProvider>;
}

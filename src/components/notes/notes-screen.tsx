"use client";

import {
  ArrowDownWideNarrowIcon,
  ChevronLeftIcon,
  EllipsisIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  LockIcon,
  LockOpenIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  RotateCcwIcon,
  SearchIcon,
  SquarePenIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { cn } from "cn";

import {
  createFolderAction,
  deleteFolderAction,
  deleteNoteAction,
  discardEmptyNoteAction,
  emptyDeletedAction,
  lockNoteAction,
  moveNoteAction,
  newNoteAction,
  pinNoteAction,
  recoverNoteAction,
  renameFolderAction,
  unlockNoteAction,
  uploadNoteFileAction,
} from "@/app/(app)/notes/actions";
import { decryptBytes, decryptText, encryptBytes, encryptText } from "@/lib/notes/lock";
import {
  DELETED_DAYS,
  FILE_NODES,
  type FolderKey,
  folderHref,
  noteFullDate,
  noteGroup,
  noteHref,
  noteListDate,
  type NoteNode,
  noteSummary,
} from "@/lib/notes/notes";
import type { NoteFolders, NoteListItem, NoteLock, OpenNote } from "@/server/notes";

import { type EditorHandle, NoteEditor, type NoteSummary, readSortPref, type SaveStatus, sortTicked, writeSortPref } from "./note-editor";
import { useNoteKey } from "./note-key";
import { LockedScreen, PasswordDialog, SetPasswordDialog } from "./note-lock";
import { ConfirmDialog, type MenuEntry, NoteMenu, PromptDialog } from "./note-ui";

export type NotesView = "folders" | "list" | "note";

const accent = "text-amber-600 dark:text-amber-400";

export function NotesScreen({
  view,
  folderKey,
  folderName,
  folders,
  list,
  note,
  lock,
  query,
}: {
  view: NotesView;
  folderKey: FolderKey;
  folderName: string;
  folders: NoteFolders;
  list: NoteListItem[];
  note: OpenNote | null;
  lock: NoteLock;
  query: string;
}) {
  // Titles and dates change as you type, before the server list is read again.
  const [live, setLive] = useState<Record<number, NoteSummary>>({});
  const onSummary = useCallback((id: number, s: NoteSummary) => setLive((l) => ({ ...l, [id]: s })), []);
  const rows = useMemo(
    () =>
      list
        .map((n) => {
          const l = live[n.id];
          return l && l.editedAt > n.editedAt ? { ...n, title: l.title, preview: n.locked ? "" : l.preview, editedAt: l.editedAt } : n;
        })
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +b.editedAt - +a.editedAt || b.id - a.id),
    [list, live],
  );

  return (
    <div className="-mx-4 -mt-4 flex min-h-[calc(100svh-3.5rem)] md:mx-0 md:mt-0 md:h-[calc(100svh-2.5rem)] md:min-h-0 md:overflow-hidden md:rounded-xl md:border">
      <FolderPane className={view === "folders" ? "flex" : "hidden md:flex"} folderKey={folderKey} folders={folders} phoneHome={view === "folders"} />
      <ListPane
        className={view === "list" ? "flex" : "hidden md:flex"}
        folderKey={folderKey}
        folderName={folderName}
        folders={folders}
        rows={rows}
        openId={note?.id ?? null}
        query={query}
      />
      <div className={cn("min-w-0 flex-1 flex-col md:overflow-y-auto", view === "note" ? "flex" : "hidden md:flex")}>
        {note ? (
          <NotePane
            key={`${note.id}-${note.locked}`}
            note={note}
            folderKey={folderKey}
            folderName={folderName}
            folders={folders}
            lock={lock}
            query={query}
            onSummary={onSummary}
          />
        ) : (
          <div className="hidden flex-1 items-center justify-center text-sm text-muted-foreground md:flex">
            {rows.length ? "Choose a note" : "No notes"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Folders */

function FolderRow({
  href,
  icon,
  label,
  count,
  active,
  menu,
  phoneHome,
}: {
  phoneHome?: boolean;
  href: string;
  icon: ReactNode;
  label: string;
  count: number;
  active: boolean;
  menu?: ReactNode;
}) {
  return (
    <li
      className={cn(
        "group relative flex items-center rounded-lg hover:bg-muted/60",
        // The phone's Folders screen has no folder open yet, so nothing is marked.
        active && (phoneHome ? "md:bg-muted" : "bg-muted"),
      )}
    >
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 md:py-2" aria-current={active ? "page" : undefined}>
        <span className={cn("shrink-0 [&_svg]:size-5", accent)}>{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        <span className={cn("text-sm text-muted-foreground tabular-nums", menu && "md:group-hover:invisible")}>{count}</span>
      </Link>
      {menu && <div className="absolute right-1 hidden md:group-hover:block md:has-[[data-popup-open]]:block">{menu}</div>}
    </li>
  );
}

function FolderPane({
  className,
  folderKey,
  folders,
  phoneHome,
}: {
  className: string;
  folderKey: FolderKey;
  folders: NoteFolders;
  phoneHome: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: number; name: string } | null>(null);

  return (
    <nav aria-label="Folders" className={cn("w-full shrink-0 flex-col border-r md:w-56 md:bg-muted/20", className)}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-3">
        <h1 className="text-3xl font-bold md:text-lg">Folders</h1>
      </div>
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        <FolderRow phoneHome={phoneHome} href={folderHref("all")} icon={<FolderIcon />} label="All Notes" count={folders.all} active={folderKey === "all"} />
        <FolderRow phoneHome={phoneHome} href={folderHref("notes")} icon={<FolderIcon />} label="Notes" count={folders.notes} active={folderKey === "notes"} />
        {folders.folders.map((f) => (
          <FolderRow
            phoneHome={phoneHome}
            key={f.id}
            href={folderHref(f.id)}
            icon={<FolderIcon />}
            label={f.name}
            count={f.count}
            active={folderKey === f.id}
            menu={
              <NoteMenu
                label={`${f.name} options`}
                className="size-8"
                trigger={<EllipsisIcon />}
                entries={[
                  { label: "Rename", icon: <PencilIcon />, onSelect: () => setRenaming(f) },
                  { label: "Delete Folder", icon: <Trash2Icon />, danger: true, onSelect: () => setDeleting(f) },
                ]}
              />
            }
          />
        ))}
        {folders.deleted > 0 && (
          <FolderRow
            phoneHome={phoneHome}
            href={folderHref("deleted")}
            icon={<Trash2Icon />}
            label="Recently Deleted"
            count={folders.deleted}
            active={folderKey === "deleted"}
          />
        )}
      </ul>
      {/* On a phone, folder options are in a menu here since there is no hover. */}
      <div className="flex items-center justify-between border-t px-2 py-2 pb-24 md:pb-2">
        <button type="button" onClick={() => setCreating(true)} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted", accent)}>
          <FolderPlusIcon className="size-5" /> New Folder
        </button>
        {folders.folders.length > 0 && (
          <span className="md:hidden">
            <NoteMenu
              label="Edit folders"
              trigger={<EllipsisIcon />}
              entries={folders.folders.map((f) => ({
                label: f.name,
                icon: <FolderIcon />,
                items: [
                  { label: "Rename", icon: <PencilIcon />, onSelect: () => setRenaming(f) },
                  { label: "Delete Folder", icon: <Trash2Icon />, danger: true, onSelect: () => setDeleting(f) },
                ],
              }))}
            />
          </span>
        )}
      </div>

      <PromptDialog
        open={creating}
        onOpenChange={setCreating}
        title="New Folder"
        description="Enter a name for this folder."
        placeholder="Name"
        confirmLabel="Save"
        onSubmit={async (name) => {
          const res = await createFolderAction(name);
          if (!res.ok) return res.error;
          setCreating(false);
          router.push(folderHref(res.value!));
        }}
      />
      <PromptDialog
        open={renaming != null}
        onOpenChange={(o) => !o && setRenaming(null)}
        title="Rename Folder"
        initial={renaming?.name}
        confirmLabel="Save"
        onSubmit={async (name) => {
          const res = await renameFolderAction(renaming!.id, name);
          if (!res.ok) return res.error;
          setRenaming(null);
        }}
      />
      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="The folder will be deleted and its notes will move to Recently Deleted."
        confirmLabel="Delete"
        onConfirm={async () => {
          const f = deleting!;
          await deleteFolderAction(f.id);
          if (folderKey === f.id) router.push(folderHref("notes"));
        }}
      />
    </nav>
  );
}

/* --------------------------------------------------------------------- List */

function ListPane({
  className,
  folderKey,
  folderName,
  folders,
  rows,
  openId,
  query,
}: {
  className: string;
  folderKey: FolderKey;
  folderName: string;
  folders: NoteFolders;
  rows: NoteListItem[];
  openId: number | null;
  query: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query);
  const [creating, startCreate] = useTransition();
  const [emptying, setEmptying] = useState(false);
  const deleted = folderKey === "deleted";
  const showFolder = folderKey === "all" || query !== "";

  // Search as you type, a moment after the last key.
  useEffect(() => {
    if (search.trim() === query) return;
    const t = setTimeout(() => {
      const q = search.trim();
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [search, query, pathname, router]);

  const newNote = () =>
    startCreate(async () => {
      const target = typeof folderKey === "number" ? folderKey : null;
      const res = await newNoteAction(target);
      if (res.ok && res.value) router.push(noteHref(deleted ? "notes" : folderKey, res.value));
    });

  const groups: { key: string; label: string; items: NoteListItem[] }[] = [];
  for (const n of rows) {
    const g = noteGroup(n.editedAt, n.pinned);
    const last = groups.at(-1);
    if (last?.key === g.key) last.items.push(n);
    else groups.push({ ...g, items: [n] });
  }
  const folderOf = (id: number | null) => (id == null ? "Notes" : (folders.folders.find((f) => f.id === id)?.name ?? "Notes"));
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";

  return (
    <section aria-label={folderName} className={cn("w-full shrink-0 flex-col border-r md:w-80", className)}>
      <div className="flex flex-col gap-2 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <Link href="/notes" className={cn("-ml-2 flex items-center text-base md:invisible", accent)}>
            <ChevronLeftIcon className="size-6" /> Folders
          </Link>
          {!deleted && (
            <button
              type="button"
              onClick={newNote}
              disabled={creating}
              aria-label="New note"
              title="New note"
              className={cn("inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-50", accent)}
            >
              <SquarePenIcon className="size-5" />
            </button>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="truncate text-3xl font-bold md:text-xl">{query ? "Search" : folderName}</h1>
          <span className="shrink-0 text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "Note" : "Notes"}
          </span>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-lg bg-muted px-2.5 text-muted-foreground">
          <SearchIcon className="size-4 shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search all notes"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch("")}>
              <XIcon className="size-4" />
            </button>
          )}
        </label>
        {deleted && rows.length > 0 && (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Notes are kept here for {DELETED_DAYS} days, then deleted for good.</span>
            <button type="button" onClick={() => setEmptying(true)} className="shrink-0 font-medium text-destructive hover:underline">
              Delete All
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-28 md:pb-2">
        {rows.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-muted-foreground">{query ? "No results" : "No Notes"}</p>
        ) : (
          groups.map((g) => (
            <div key={g.key} className="mb-3">
              <h2 className="flex items-center gap-1 px-3 py-1 text-sm font-semibold text-muted-foreground">
                {g.key === "pinned" && <PinIcon className={cn("size-3.5", accent)} />}
                {g.label}
              </h2>
              <ul className="flex flex-col">
                {g.items.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`${noteHref(folderKey, n.id)}${suffix}`}
                      aria-current={n.id === openId ? "page" : undefined}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-lg border-b border-border/60 px-3 py-2.5 last:border-b-0",
                        n.id === openId ? "border-transparent bg-muted" : "hover:bg-muted/50",
                      )}
                    >
                      <span className="flex items-center gap-1.5 truncate font-semibold">
                        {n.locked && <LockIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                        <span className="truncate">{n.title || "New Note"}</span>
                      </span>
                      <span className="flex gap-2 text-sm text-muted-foreground">
                        <span className="shrink-0">{noteListDate(n.editedAt)}</span>
                        <span className="truncate">{n.locked ? "Locked" : n.preview || "No additional text"}</span>
                      </span>
                      {showFolder && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FolderIcon className="size-3" /> {folderOf(n.folderId)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
      <ConfirmDialog
        open={emptying}
        onOpenChange={setEmptying}
        title="Delete all notes?"
        description="These notes will be deleted for good. This can't be undone."
        confirmLabel="Delete All"
        onConfirm={async () => {
          await emptyDeletedAction();
          router.push(folderHref("deleted"));
        }}
      />
    </section>
  );
}

/* --------------------------------------------------------------------- Note */

/** Goes through a note's photos and files, replacing each as `swap` says. */
async function swapFiles(node: NoteNode, swap: (attrs: Record<string, unknown>) => Promise<Record<string, unknown> | null>) {
  if (FILE_NODES.has(node.type) && node.attrs) {
    const next = await swap(node.attrs);
    if (next) node.attrs = next;
  }
  for (const c of node.content ?? []) await swapFiles(c, swap);
}

async function fetchFile(id: unknown) {
  const res = await fetch(`/note-files/${String(id)}`);
  if (!res.ok) throw new Error("A photo in this note could not be read. Please try again.");
  return new Uint8Array(await res.arrayBuffer());
}

function NotePane({
  note,
  folderKey,
  folderName,
  folders,
  lock,
  query,
  onSummary,
}: {
  note: OpenNote;
  folderKey: FolderKey;
  folderName: string;
  folders: NoteFolders;
  lock: NoteLock;
  query: string;
  onSummary: (id: number, s: NoteSummary) => void;
}) {
  const router = useRouter();
  const { key, setKey } = useNoteKey();
  const [handle, setHandle] = useState<EditorHandle | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [notice, setNotice] = useState<string>();
  const [editedAt, setEditedAt] = useState(note.editedAt);
  const [busy, setBusy] = useState<string>();
  const [askPassword, setAskPassword] = useState<null | ((k: CryptoKey) => void)>(null);
  const [setPassword, setSetPassword] = useState<null | ((k: CryptoKey) => void)>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Only read when the menu opens, so the server and browser render the same.
  const [sortPref, setSortPref] = useState(() => typeof window !== "undefined" && readSortPref());

  // A locked note is decrypted here, in the browser, once the key is known.
  const [body, setBody] = useState<NoteNode | null | undefined>(note.locked ? undefined : note.body);
  const [lockKey, setLockKey] = useState<CryptoKey | null>(null);
  useEffect(() => {
    if (!note.locked || !key || !note.cipher) return;
    let live = true;
    decryptText(key, note.cipher)
      .then((text) => {
        if (!live) return;
        setLockKey(key);
        setBody(JSON.parse(text) as NoteNode);
      })
      .catch(() => live && setNotice("This note could not be opened with the current password."));
    return () => {
      live = false;
    };
  }, [note.locked, note.cipher, key]);
  // "Lock Now" or the idle timer closes an open locked note.
  const showLocked = note.locked && (!key || !lockKey);

  const deleted = note.deletedAt != null;
  const backHref = `${folderHref(folderKey)}${query ? `?q=${encodeURIComponent(query)}` : ""}`;

  const onLeave = useCallback(
    (empty: boolean) => {
      if (empty && !deleted) void discardEmptyNoteAction(note.id);
    },
    [note.id, deleted],
  );
  const summary = useCallback(
    (s: NoteSummary) => {
      setEditedAt(s.editedAt);
      onSummary(note.id, s);
    },
    [note.id, onSummary],
  );
  const onStatus = useCallback((s: SaveStatus, error?: string) => {
    setStatus(s);
    if (s === "error" || s === "conflict") setNotice(error);
    else if (s === "saved") setNotice(undefined);
  }, []);

  /** Gets the key: asks for the password, or sets one up the first time. */
  const withKey = (then: (k: CryptoKey) => void) => {
    if (key) return then(key);
    if (lock) setAskPassword(() => (k: CryptoKey) => {
      setKey(k);
      then(k);
    });
    else setSetPassword(() => (k: CryptoKey) => {
      setKey(k);
      then(k);
    });
  };

  const lockThis = (k: CryptoKey) =>
    void (async () => {
      if (!handle) return;
      setBusy("Locking…");
      handle.editor.setEditable(false);
      try {
        if (!(await handle.flush())) throw new Error("Save the note first, then lock it.");
        const json = handle.editor.getJSON() as NoteNode;
        const ids: string[] = [];
        await swapFiles(json, async (attrs) => {
          if (attrs.encrypted) {
            ids.push(String(attrs.fileId));
            return null;
          }
          const form = new FormData();
          form.append("file", new Blob([await encryptBytes(k, await fetchFile(attrs.fileId))]), "locked");
          form.append("encrypted", "1");
          const up = await uploadNoteFileAction(note.id, form);
          if (!up.ok || !up.value) throw new Error(up.error ?? "Could not lock a photo.");
          ids.push(up.value);
          return { ...attrs, fileId: up.value, encrypted: true };
        });
        const cipher = await encryptText(k, JSON.stringify(json));
        const res = await lockNoteAction(note.id, handle.version(), noteSummary(json).title, cipher, ids);
        if (!res.ok) throw new Error(res.error);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Could not lock the note.");
        handle.editor.setEditable(true);
      } finally {
        setBusy(undefined);
      }
    })();

  const unlockThis = () =>
    void (async () => {
      if (!handle || !lockKey) return;
      setBusy("Removing lock…");
      handle.editor.setEditable(false);
      try {
        if (!(await handle.flush())) throw new Error("Save the note first, then remove the lock.");
        const json = handle.editor.getJSON() as NoteNode;
        await swapFiles(json, async (attrs) => {
          if (!attrs.encrypted) return null;
          const plain = await decryptBytes(lockKey, await fetchFile(attrs.fileId));
          const form = new FormData();
          form.append("file", new Blob([plain], { type: String(attrs.mimeType) }), String(attrs.name || "file"));
          const up = await uploadNoteFileAction(note.id, form);
          if (!up.ok || !up.value) throw new Error(up.error ?? "Could not unlock a photo.");
          return { ...attrs, fileId: up.value, encrypted: false };
        });
        const res = await unlockNoteAction(note.id, handle.version(), JSON.stringify(json));
        if (!res.ok) throw new Error(res.error);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : "Could not remove the lock.");
        handle.editor.setEditable(true);
      } finally {
        setBusy(undefined);
      }
    })();

  const moveTo = async (target: number | null) => {
    await handle?.flush();
    const res = await moveNoteAction(note.id, target);
    if (!res.ok) return setNotice(res.error);
    router.push(noteHref(target ?? "notes", note.id));
  };

  const remove = async () => {
    await handle?.flush();
    const res = await deleteNoteAction(note.id);
    if (!res.ok) return setNotice(res.error);
    router.push(backHref);
  };

  const menu: (MenuEntry | "-")[] = deleted
    ? [
        { label: "Recover", icon: <RotateCcwIcon />, onSelect: () => void recoverNoteAction(note.id).then(() => router.push(noteHref(note.folderId ?? "notes", note.id))) },
        "-",
        { label: "Delete Permanently", icon: <Trash2Icon />, danger: true, onSelect: () => setConfirmDelete(true) },
      ]
    : [
        note.pinned
          ? { label: "Unpin Note", icon: <PinOffIcon />, onSelect: () => void pinNoteAction(note.id, false) }
          : { label: "Pin Note", icon: <PinIcon />, onSelect: () => void pinNoteAction(note.id, true) },
        note.locked
          ? { label: "Remove Lock", icon: <LockOpenIcon />, disabled: showLocked, onSelect: unlockThis }
          : { label: "Lock Note", icon: <LockIcon />, disabled: !handle, onSelect: () => withKey(lockThis) },
        ...(key ? [{ label: "Lock Now", icon: <LockIcon />, onSelect: () => setKey(null) }] : []),
        {
          label: "Move Note",
          icon: <FolderInputIcon />,
          items: [
            { label: "Notes", icon: <FolderIcon />, disabled: note.folderId == null, onSelect: () => void moveTo(null) },
            ...folders.folders.map((f) => ({
              label: f.name,
              icon: <FolderIcon />,
              disabled: note.folderId === f.id,
              onSelect: () => void moveTo(f.id),
            })),
          ],
        },
        "-",
        { label: "Move Ticked to Bottom", icon: <ArrowDownWideNarrowIcon />, disabled: !handle, onSelect: () => handle && sortTicked(handle.editor) },
        {
          label: "Auto-Move Ticked Items",
          icon: <ArrowDownWideNarrowIcon />,
          checked: sortPref,
          onSelect: () => {
            writeSortPref(!sortPref);
            setSortPref(!sortPref);
          },
        },
        "-",
        { label: "Delete Note", icon: <Trash2Icon />, danger: true, onSelect: () => void remove() },
      ];

  const statusText =
    busy ??
    (status === "saving" ? "Saving…" : status === "error" ? "Not saved" : status === "conflict" ? "Changed on another device" : noteFullDate(editedAt));

  const header = (
    <div className="flex h-12 items-center gap-2 px-2">
      <Link href={backHref} className={cn("mr-auto flex min-w-0 items-center text-base md:hidden", accent)}>
        <ChevronLeftIcon className="size-6 shrink-0" />
        <span className="truncate">{query ? "Search" : folderName}</span>
      </Link>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-center text-xs text-muted-foreground",
          (status === "error" || status === "conflict") && "text-destructive",
          // A phone has no room for the date beside the back button; it shows only save problems.
          status === "saved" && !busy && "hidden md:block",
        )}
        aria-live="polite"
      >
        {statusText}
      </span>
      {status === "conflict" ? (
        <button type="button" onClick={() => location.reload()} className={cn("text-sm font-medium", accent)}>
          Reload
        </button>
      ) : status === "error" ? (
        <button type="button" onClick={() => void handle?.flush()} className={cn("text-sm font-medium", accent)}>
          Retry
        </button>
      ) : null}
      <NoteMenu label="Note options" trigger={<EllipsisIcon />} entries={menu} />
    </div>
  );

  const noticeBar = (notice || deleted) && (
    <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm md:mx-8">
      <span className="flex-1">{notice ?? `This note is in Recently Deleted. Recover it to make changes.`}</span>
      {notice ? (
        <button type="button" aria-label="Dismiss" onClick={() => setNotice(undefined)} className="text-muted-foreground">
          <XIcon className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          className={cn("font-medium", accent)}
          onClick={() => void recoverNoteAction(note.id).then(() => router.push(noteHref(note.folderId ?? "notes", note.id)))}
        >
          Recover
        </button>
      )}
    </div>
  );

  return (
    <>
      {showLocked ? (
        <>
          <div className="sticky top-14 z-10 border-b bg-background/95 backdrop-blur md:top-0">{header}</div>
          {noticeBar}
          {lock && <LockedScreen lock={lock} onKey={setKey} />}
        </>
      ) : body === undefined ? (
        <div className="sticky top-14 z-10 border-b bg-background/95 backdrop-blur md:top-0">{header}</div>
      ) : (
        <NoteEditor
          key={lockKey ? "locked" : "open"}
          header={header}
          noteId={note.id}
          initialBody={body}
          initialVersion={note.version}
          lockKey={note.locked ? lockKey : null}
          readOnly={deleted}
          onSummary={summary}
          onStatus={onStatus}
          onReady={setHandle}
          onLeave={onLeave}
          onError={setNotice}
        >
          {noticeBar}
          {/* On a phone the date sits above the note, as on an iPhone. */}
          <p className="pt-3 text-center text-xs text-muted-foreground md:hidden">{noteFullDate(editedAt)}</p>
        </NoteEditor>
      )}
      {lock && (
        <PasswordDialog open={askPassword != null} onOpenChange={(o) => !o && setAskPassword(null)} lock={lock} onKey={(k) => askPassword?.(k)} />
      )}
      <SetPasswordDialog open={setPassword != null} onOpenChange={(o) => !o && setSetPassword(null)} onKey={(k) => setPassword?.(k)} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this note?"
        description="It will be deleted for good. This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />
    </>
  );
}


"use client";

import { Popover } from "@base-ui/react/popover";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  BoldIcon,
  CircleCheckIcon,
  CodeIcon,
  HighlighterIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  LoaderIcon,
  MicIcon,
  PaperclipIcon,
  SquareIcon,
  QuoteIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";

import { saveLockedNoteAction, saveNoteAction, uploadNoteFileAction } from "@/app/(app)/notes/actions";
import { encryptBytes, encryptText } from "@/lib/notes/lock";
import { NOTE_FILE_MAX, NOTE_IMAGE_TYPES, type NoteNode, noteSummary } from "@/lib/notes/notes";

import { NoteAudio, NoteFile, NoteImage } from "./note-nodes";
import { canRecordVoice, useVoiceNote } from "./note-recorder";

export interface NoteSummary {
  title: string;
  preview: string;
  editedAt: Date;
}

export type SaveStatus = "saved" | "saving" | "error" | "conflict";

/** What the note's menu needs from the open editor. */
export interface EditorHandle {
  editor: Editor;
  /** Saves now and waits; false if it could not save. */
  flush: () => Promise<boolean>;
  version: () => number;
  setVersion: (v: number) => void;
}

const SORT_PREF = "notes.sortTicked";
export const readSortPref = () => {
  try {
    return localStorage.getItem(SORT_PREF) === "1";
  } catch {
    return false;
  }
};
export const writeSortPref = (on: boolean) => {
  try {
    localStorage.setItem(SORT_PREF, on ? "1" : "0");
  } catch {
    /* private window: the choice is just not remembered */
  }
};

/** Puts ticked items under the unticked ones in every checklist, as Apple Notes does. */
export function sortTicked(editor: Editor) {
  const { state } = editor;
  const lists: { pos: number; node: PmNode }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === "taskList") lists.push({ pos, node });
  });
  let tr = state.tr;
  let changed = false;
  for (const { pos, node } of lists.reverse()) {
    const items: PmNode[] = [];
    node.forEach((c) => items.push(c));
    const sorted = [...items.filter((c) => !c.attrs.checked), ...items.filter((c) => c.attrs.checked)];
    if (sorted.every((c, i) => c === items[i])) continue;
    tr = tr.replaceWith(pos + 1, pos + node.nodeSize - 1, Fragment.fromArray(sorted));
    changed = true;
  }
  if (changed) editor.view.dispatch(tr);
}

const tickedCount = (editor: Editor) => {
  let n = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "taskItem" && node.attrs.checked) n++;
  });
  return n;
};

/** Makes big photos smaller before upload, so notes stay quick on a phone. */
async function shrinkPhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 600_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Uploads one file into the note (encrypted first for a locked note) and returns the node to insert. */
/** `seconds` is the length of a voice note just recorded. */
export async function uploadIntoNote(noteId: number, file: File, key: CryptoKey | null, seconds = 0) {
  const isImage = NOTE_IMAGE_TYPES.has(file.type);
  const isAudio = file.type.startsWith("audio/");
  const blob = isImage ? await shrinkPhoto(file) : file;
  if (blob.size > NOTE_FILE_MAX) throw new Error(`"${file.name}" is bigger than 4 MB.`);
  const mimeType = blob.type || file.type || "application/octet-stream";
  const form = new FormData();
  if (key) {
    form.append("file", new Blob([await encryptBytes(key, await blob.arrayBuffer())]), "locked");
    form.append("encrypted", "1");
  } else {
    form.append("file", blob, file.name);
  }
  const res = await uploadNoteFileAction(noteId, form);
  if (!res.ok || !res.value) throw new Error(res.error ?? "Could not add the file.");
  return {
    type: isImage ? "noteImage" : isAudio ? "noteAudio" : "noteFile",
    attrs: {
      fileId: res.value,
      encrypted: !!key,
      mimeType,
      name: file.name.slice(0, 200),
      size: blob.size,
      duration: Math.round(seconds * 10) / 10,
    },
  };
}

/** Notes waiting to be thrown away if they are left empty; cancelled if the same note opens again at once. */
const pendingLeave = new Map<number, ReturnType<typeof setTimeout>>();

/**
 * The newest words of each note open in this tab, and the version they were last saved
 * at. The app keeps screens alive in the background and may show a page it loaded
 * earlier, so a note opened again can arrive with older words than were typed. The
 * editor starts from whichever copy is newer. Kept for unlocked notes only.
 */
const latestNotes = new Map<number, { json: NoteNode; version: number }>();

export function NoteEditor({
  noteId,
  initialBody,
  initialVersion,
  lockKey,
  readOnly,
  onSummary,
  onStatus,
  onReady,
  onLeave,
  onError,
  header,
  children,
}: {
  /** The bar above the toolbar: back, date, menu. */
  header: ReactNode;
  /** Shown between the toolbar and the words, such as a notice. */
  children?: ReactNode;
  noteId: number;
  initialBody: NoteNode | null;
  initialVersion: number;
  /** Set for a locked note: every save is encrypted with it. */
  lockKey: CryptoKey | null;
  readOnly: boolean;
  onSummary: (s: NoteSummary) => void;
  onStatus: (s: SaveStatus, error?: string) => void;
  onReady: (h: EditorHandle | null) => void;
  /** Called after the last save when the note closes, with whether it was empty. */
  onLeave: (empty: boolean) => void;
  onError: (message: string) => void;
}) {
  const known = lockKey ? undefined : latestNotes.get(noteId);
  const startFrom = known && known.version >= initialVersion ? known : null;
  const version = useRef(startFrom?.version ?? initialVersion);
  const dirty = useRef(false);
  const blocked = useRef(false);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ticked = useRef(-1);
  const callbacks = useRef({ onSummary, onStatus, onLeave });
  useEffect(() => {
    callbacks.current = { onSummary, onStatus, onLeave };
  });

  const send = useCallback(
    async (json: NoteNode): Promise<boolean> => {
      callbacks.current.onStatus("saving");
      const res = lockKey
        ? await saveLockedNoteAction(noteId, version.current, noteSummary(json).title, await encryptText(lockKey, JSON.stringify(json)))
        : await saveNoteAction(noteId, version.current, JSON.stringify(json));
      if (res.ok && res.value) {
        version.current = res.value;
        const entry = latestNotes.get(noteId);
        if (entry) entry.version = res.value;
        if (!dirty.current) callbacks.current.onStatus("saved");
        return true;
      }
      dirty.current = true;
      if (res.conflict) blocked.current = true;
      callbacks.current.onStatus(res.conflict ? "conflict" : "error", res.error);
      return false;
    },
    [noteId, lockKey],
  );

  const editorRef = useRef<Editor | null>(null);
  const again = useRef<() => Promise<boolean>>(async () => true);

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    const editor = editorRef.current;
    if (!dirty.current || blocked.current || !editor || editor.isDestroyed) return !dirty.current;
    dirty.current = false;
    const p = send(editor.getJSON() as NoteNode);
    inFlight.current = p;
    const ok = await p;
    inFlight.current = null;
    if (dirty.current && ok) timer.current = setTimeout(() => void again.current(), 600);
    return ok;
  }, [send]);
  useEffect(() => {
    again.current = flush;
  }, [flush]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    // A new, empty note starts typing on the title line, as in Apple Notes.
    autofocus: !readOnly && !noteSummary(initialBody).searchText ? "start" : false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: true, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto", "tel"] },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      NoteImage,
      NoteFile,
      NoteAudio,
      Placeholder.configure({
        placeholder: ({ editor: e, node }) => (node.type.name === "heading" && e.state.doc.firstChild === node ? "Title" : ""),
      }),
    ],
    content: startFrom?.json ?? initialBody ?? { type: "doc", content: [{ type: "heading", attrs: { level: 1 } }] },
    editorProps: {
      attributes: { class: "note-body outline-none", "aria-label": "Note" },
      handlePaste: (_view, event) => dropFiles(event.clipboardData?.files),
      handleDrop: (_view, event) => dropFiles((event as DragEvent).dataTransfer?.files),
    },
    onCreate: ({ editor: e }) => {
      ticked.current = tickedCount(e);
    },
    onUpdate: ({ editor: e }) => {
      dirty.current = true;
      const json = e.getJSON() as NoteNode;
      if (!lockKey) latestNotes.set(noteId, { json, version: version.current });
      const s = noteSummary(json);
      callbacks.current.onSummary({ title: s.title, preview: lockKey ? "" : s.preview, editedAt: new Date() });
      callbacks.current.onStatus("saving");
      const nowTicked = tickedCount(e);
      if (nowTicked > ticked.current && readSortPref()) setTimeout(() => !e.isDestroyed && sortTicked(e), 350);
      ticked.current = nowTicked;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 700);
    },
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Photos pasted or dropped into the note.
  const dropRef = useRef<(files: File[]) => void>(() => {});
  function dropFiles(list: FileList | null | undefined) {
    const files = list ? [...list] : [];
    if (files.length === 0 || readOnly) return false;
    dropRef.current(files);
    return true;
  }
  const addFiles = useCallback(
    async (files: File[], seconds?: number) => {
      const e = editorRef.current;
      if (!e) return;
      for (const f of files) {
        try {
          const node = await uploadIntoNote(noteId, f, lockKey, seconds);
          e.chain().focus().insertContent([node, { type: "paragraph" }]).run();
        } catch (err) {
          onError(err instanceof Error ? err.message : "Could not add the file.");
        }
      }
    },
    [noteId, lockKey, onError],
  );
  useEffect(() => {
    dropRef.current = (files) => void addFiles(files);
  }, [addFiles]);

  // Hand the editor to the menu, save when the app is hidden, and save on close.
  useEffect(() => {
    if (!editor) return;
    clearTimeout(pendingLeave.get(noteId));
    // The editor can be rebuilt while this screen stays alive (it was hidden, then shown
    // again). Put back the newest words so it never shows, and then saves over, older ones.
    const newest = lockKey ? undefined : latestNotes.get(noteId);
    if (newest && newest.version >= version.current && !editor.isDestroyed) {
      version.current = newest.version;
      if (JSON.stringify(editor.getJSON()) !== JSON.stringify(newest.json)) {
        editor.commands.setContent(newest.json, { emitUpdate: false });
      }
    }
    onReady({
      editor,
      flush,
      version: () => version.current,
      // Locking or unlocking saves the note another way; forget the plain copy kept here.
      setVersion: (v) => {
        version.current = v;
        latestNotes.delete(noteId);
      },
    });
    const hide = () => document.visibilityState === "hidden" && void flush();
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) {
        void flush();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("beforeunload", unload);
      onReady(null);
      const json = editor.isDestroyed ? null : (editor.getJSON() as NoteNode);
      pendingLeave.set(
        noteId,
        setTimeout(async () => {
          pendingLeave.delete(noteId);
          clearTimeout(timer.current);
          if (inFlight.current) await inFlight.current;
          if (dirty.current && !blocked.current && json) {
            dirty.current = false;
            await send(json);
          }
          const s = noteSummary(json);
          callbacks.current.onLeave(!lockKey && !s.title && !s.searchText);
        }, 0),
      );
    };
  }, [editor, noteId, flush, send, onReady, lockKey]);

  if (!editor) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
          <LoaderIcon className="size-5 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-14 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:top-0">
        {header}
        {!readOnly && <Toolbar editor={editor} onFiles={addFiles} onError={onError} />}
      </div>
      {children}
      <EditorContent editor={editor} className="flex-1 px-5 pt-3 pb-32 md:px-8" />
    </>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
  className,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-2 text-amber-600 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-amber-400 [&_svg]:size-5",
        active && "bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

const STYLES = [
  { key: "title", label: "Title", className: "text-xl font-bold" },
  { key: "heading", label: "Heading", className: "text-lg font-bold" },
  { key: "subheading", label: "Subheading", className: "font-semibold" },
  { key: "body", label: "Body", className: "" },
  { key: "mono", label: "Monostyled", className: "font-mono text-sm" },
] as const;

function Toolbar({
  editor,
  onFiles,
  onError,
}: {
  editor: Editor;
  onFiles: (files: File[], seconds?: number) => Promise<void>;
  onError: (message: string) => void;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      style: e.isActive("heading", { level: 1 })
        ? "title"
        : e.isActive("heading", { level: 2 })
          ? "heading"
          : e.isActive("heading", { level: 3 })
            ? "subheading"
            : e.isActive("codeBlock")
              ? "mono"
              : "body",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("code"),
      task: e.isActive("taskList"),
      table: e.isActive("table"),
    }),
  });
  const [uploading, setUploading] = useState(false);
  const voice = useVoiceNote(
    (file, seconds) => {
      setUploading(true);
      void onFiles([file], seconds).finally(() => setUploading(false));
    },
    onError,
  );
  const [micOk] = useState(canRecordVoice);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const c = () => editor.chain().focus();
  const setStyle = (key: (typeof STYLES)[number]["key"]) => {
    if (key === "title") c().setHeading({ level: 1 }).run();
    else if (key === "heading") c().setHeading({ level: 2 }).run();
    else if (key === "subheading") c().setHeading({ level: 3 }).run();
    else if (key === "mono") c().setCodeBlock().run();
    else c().setParagraph().run();
  };
  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    await onFiles([...list]);
    setUploading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-0.5 overflow-x-auto px-2 pb-1">
        <Popover.Root>
          <Popover.Trigger
            aria-label="Text style"
            title="Text style"
            onMouseDown={(e) => e.preventDefault()}
            className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-base font-semibold text-amber-600 hover:bg-muted data-[popup-open]:bg-muted dark:text-amber-400"
          >
            Aa
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={12} className="z-50">
              <Popover.Popup initialFocus={false} className="flex w-72 flex-col gap-2 rounded-2xl border bg-popover p-3 text-popover-foreground shadow-xl outline-none">
                <p className="text-center text-sm font-semibold">Format</p>
                <div className="flex gap-1 overflow-x-auto">
                  {STYLES.map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setStyle(st.key)}
                      className={cn(
                        "shrink-0 rounded-lg px-2.5 py-1.5 whitespace-nowrap hover:bg-muted",
                        st.className,
                        s.style === st.key && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1 rounded-xl bg-muted/50 p-1">
                  <ToolButton label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}>
                    <BoldIcon />
                  </ToolButton>
                  <ToolButton label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}>
                    <ItalicIcon />
                  </ToolButton>
                  <ToolButton label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}>
                    <UnderlineIcon />
                  </ToolButton>
                  <ToolButton label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}>
                    <StrikethroughIcon />
                  </ToolButton>
                  <ToolButton label="Highlight" active={s.highlight} onClick={() => c().toggleHighlight().run()}>
                    <HighlighterIcon />
                  </ToolButton>
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted/50 p-1">
                  <ToolButton label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
                    <ListIcon />
                  </ToolButton>
                  <ToolButton label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>
                    <ListOrderedIcon />
                  </ToolButton>
                  <ToolButton label="Block quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>
                    <QuoteIcon />
                  </ToolButton>
                  <ToolButton label="Code" active={s.code} onClick={() => c().toggleCode().run()}>
                    <CodeIcon />
                  </ToolButton>
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <ToolButton label="Checklist" active={s.task} onClick={() => c().toggleTaskList().run()}>
          <CircleCheckIcon />
        </ToolButton>
        <ToolButton
          label="Table"
          active={s.table}
          onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()}
        >
          <TableIcon />
        </ToolButton>
        <ToolButton label="Add photo" onClick={() => photoInput.current?.click()}>
          {uploading ? <LoaderIcon className="animate-spin" /> : <PhotoIcon />}
        </ToolButton>
        <ToolButton label="Attach file" onClick={() => fileInput.current?.click()}>
          <PaperclipIcon />
        </ToolButton>
        {micOk && voice.seconds == null && (
          <ToolButton label="Record voice note" onClick={() => void voice.start()}>
            <MicIcon />
          </ToolButton>
        )}
        {s.table && (
          <div className="ml-1 flex shrink-0 items-center gap-0.5 border-l pl-1 text-xs">
            {(
              [
                ["+ Row", () => c().addRowAfter().run()],
                ["+ Column", () => c().addColumnAfter().run()],
                ["− Row", () => c().deleteRow().run()],
                ["− Column", () => c().deleteColumn().run()],
                ["Delete table", () => c().deleteTable().run()],
              ] as const
            ).map(([label, fn]) => (
              <ToolButton key={label} label={label} onClick={fn} className="text-xs whitespace-nowrap">
                {label}
              </ToolButton>
            ))}
          </div>
        )}
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void pick(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            void pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {voice.seconds != null && (
        <div className="flex items-center gap-3 border-t px-4 py-2" role="status">
          <span className="size-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
          <span className="flex-1 text-sm font-medium tabular-nums">
            Recording {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, "0")}
          </span>
          <button type="button" onClick={voice.cancel} className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            type="button"
            onClick={voice.stop}
            className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-sm font-medium text-white"
          >
            <SquareIcon className="size-3.5 fill-current" /> Done
          </button>
        </div>
      )}
    </div>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="15" rx="3" />
      <circle cx="12" cy="12.5" r="3.5" />
      <path d="M9 5l1.5-2h3L15 5" />
    </svg>
  );
}

/** Shared rules for Notes, used by the browser and the server. */

/** A note body as the editor stores it (ProseMirror JSON). */
export interface NoteNode {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: NoteNode[];
  text?: string;
}

/** Largest note body we accept, as JSON text (photos are stored apart). */
export const NOTE_BODY_MAX = 900_000;
/** Largest file a note can hold. Photos are made smaller in the browser first. */
export const NOTE_FILE_MAX = 4 * 1024 * 1024;
/** All note files of one person together. */
export const NOTE_STORAGE_LIMIT = 150 * 1024 * 1024;
/** Notes stay in Recently Deleted this long, as in Apple Notes. */
export const DELETED_DAYS = 30;
export const FOLDER_NAME_MAX = 60;
/** Locked notes: PBKDF2 rounds for turning the password into a key. */
export const LOCK_ITERATIONS = 600_000;
/** The phrase encrypted with the key; decrypting it proves the password is right. */
export const LOCK_CHECK_PHRASE = "asm-notes-lock-v1";

/** Random ids for files: 32 hex characters. */
export const NOTE_FILE_ID = /^[0-9a-f]{32}$/;

/** Photo types a browser may show straight from the server. Anything else downloads. */
export const NOTE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "noteImage",
  "noteFile",
]);
const MARK_TYPES = new Set(["bold", "italic", "underline", "strike", "code", "link", "highlight"]);
const SAFE_LINK = /^(https?:|mailto:|tel:)/i;
const MAX_DEPTH = 40;

/**
 * True when the body is a note the editor can show safely: only known parts,
 * links that cannot run script, and files referred to by id only.
 */
export function isSafeNoteBody(body: unknown): body is NoteNode {
  const ok = (n: unknown, depth: number): boolean => {
    if (depth > MAX_DEPTH || typeof n !== "object" || n === null || Array.isArray(n)) return false;
    const node = n as NoteNode;
    if (typeof node.type !== "string" || !NODE_TYPES.has(node.type)) return false;
    if (node.text !== undefined && typeof node.text !== "string") return false;
    if (node.type === "noteImage" || node.type === "noteFile") {
      if (typeof node.attrs?.fileId !== "string" || !NOTE_FILE_ID.test(node.attrs.fileId)) return false;
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks)) return false;
      for (const m of node.marks) {
        if (typeof m !== "object" || m === null || !MARK_TYPES.has(m.type)) return false;
        if (m.type === "link" && !SAFE_LINK.test(String(m.attrs?.href ?? ""))) return false;
      }
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) return false;
      return node.content.every((c) => ok(c, depth + 1));
    }
    return true;
  };
  return ok(body, 0) && (body as NoteNode).type === "doc";
}

const BLOCKS = new Set(["paragraph", "heading", "codeBlock", "tableCell", "tableHeader"]);

/** The note as lines of plain text, one per paragraph, heading or list item. */
export function noteLines(body: NoteNode | null | undefined): string[] {
  const lines: string[] = [];
  const walk = (n: NoteNode) => {
    if (n.type === "noteImage") return void lines.push("Photo");
    if (n.type === "noteFile") return void lines.push(String(n.attrs?.name ?? "File"));
    if (BLOCKS.has(n.type)) {
      let s = "";
      const text = (c: NoteNode) => {
        if (c.type === "text") s += c.text ?? "";
        else if (c.type === "hardBreak") s += " ";
        c.content?.forEach(text);
      };
      n.content?.forEach(text);
      lines.push(s);
      return;
    }
    n.content?.forEach(walk);
  };
  if (body) walk(body);
  return lines.map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l !== "");
}

/** Title (first line), preview (the next line) and the words for search. */
export function noteSummary(body: NoteNode | null | undefined) {
  const lines = noteLines(body);
  const words = lines.filter((l) => l !== "Photo");
  return {
    title: (words[0] ?? "").slice(0, 200),
    preview: (words[1] ?? (lines.length > 1 ? "Photo" : "")).slice(0, 200),
    searchText: lines.join("\n").slice(0, 100_000),
  };
}

/** Every file id the note's body points to. */
export function noteFileIds(body: NoteNode | null | undefined): string[] {
  const ids: string[] = [];
  const walk = (n: NoteNode) => {
    if ((n.type === "noteImage" || n.type === "noteFile") && typeof n.attrs?.fileId === "string") ids.push(n.attrs.fileId);
    n.content?.forEach(walk);
  };
  if (body) walk(body);
  return ids;
}

export type NoteGroup = "pinned" | "today" | "yesterday" | "week" | "month" | string;

/** Dates in the shop's time zone, as YYYY-MM-DD. */
const dayIn = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * Which heading a note sits under in the list, as in Apple Notes: Pinned,
 * Today, Yesterday, Previous 7 Days, Previous 30 Days, then by month.
 */
export function noteGroup(editedAt: Date, pinned: boolean, now = new Date()): { key: string; label: string } {
  if (pinned) return { key: "pinned", label: "Pinned" };
  const day = dayIn(editedAt);
  const today = dayIn(now);
  const daysAgo = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
  if (daysAgo <= 0) return { key: "today", label: "Today" };
  if (daysAgo === 1) return { key: "yesterday", label: "Yesterday" };
  if (daysAgo <= 7) return { key: "week", label: "Previous 7 Days" };
  if (daysAgo <= 30) return { key: "month", label: "Previous 30 Days" };
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const label = editedAt.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return { key: day.slice(0, 7), label };
}

/** The short date in the list: a time today, a weekday this week, else the date. */
export function noteListDate(editedAt: Date, now = new Date()): string {
  const daysAgo = Math.round((Date.parse(dayIn(now)) - Date.parse(dayIn(editedAt))) / 86_400_000);
  const tz = "Asia/Kolkata";
  if (daysAgo <= 0) return editedAt.toLocaleTimeString("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return editedAt.toLocaleDateString("en-IN", { timeZone: tz, weekday: "long" });
  return editedAt.toLocaleDateString("en-IN", { timeZone: tz, day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** The full date at the top of an open note, e.g. "20 November 2026 at 3:45 pm". */
export function noteFullDate(editedAt: Date): string {
  const tz = "Asia/Kolkata";
  const date = editedAt.toLocaleDateString("en-IN", { timeZone: tz, day: "numeric", month: "long", year: "numeric" });
  const time = editedAt.toLocaleTimeString("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}

/** Where a folder lives in the address bar. */
export type FolderKey = "all" | "notes" | "deleted" | number;

export function parseFolderKey(s: string | undefined): FolderKey | null {
  if (s === "all" || s === "notes" || s === "deleted") return s;
  if (s && /^[1-9]\d{0,9}$/.test(s)) return Number(s);
  return null;
}

export const folderHref = (f: FolderKey) => `/notes/${f}`;
export const noteHref = (f: FolderKey, id: number) => `/notes/${f}/${id}`;

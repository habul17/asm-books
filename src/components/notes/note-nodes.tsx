"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { FileIcon, ImageOffIcon, LoaderIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "cn";

import { formatBytes } from "@/lib/documents/documents";
import { decryptBytes } from "@/lib/notes/lock";
import { NOTE_FILE_ID } from "@/lib/notes/notes";

import { useNoteKey } from "./note-key";

const fileUrl = (id: string) => (NOTE_FILE_ID.test(id) ? `/note-files/${id}` : null);

/** The file's bytes as a blob address, decrypting it first when it belongs to a locked note. */
export function useFileUrl(fileId: string, encrypted: boolean, mimeType: string) {
  const { key } = useNoteKey();
  const [url, setUrl] = useState<string | null>(encrypted ? null : fileUrl(fileId));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!encrypted) return;
    let made: string | null = null;
    let live = true;
    (async () => {
      const src = fileUrl(fileId);
      if (!src || !key) throw new Error("locked");
      const res = await fetch(src);
      if (!res.ok) throw new Error("missing");
      const plain = await decryptBytes(key, new Uint8Array(await res.arrayBuffer()));
      made = URL.createObjectURL(new Blob([plain], { type: mimeType }));
      if (live) setUrl(made);
    })().catch(() => live && setFailed(true));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [fileId, encrypted, mimeType, key]);
  return { url, failed };
}

function ImageView({ node, selected }: ReactNodeViewProps) {
  const { fileId, encrypted, mimeType, name } = node.attrs as { fileId: string; encrypted: boolean; mimeType: string; name: string };
  const { url, failed } = useFileUrl(fileId, encrypted, mimeType);
  return (
    <NodeViewWrapper className="my-2" data-drag-handle>
      {failed ? (
        <div className="flex h-32 items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground">
          <ImageOffIcon className="size-4" /> Photo could not be loaded
        </div>
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a private photo from this app, any size
        <img
          src={url}
          alt={name || "Photo"}
          className={cn("max-h-[32rem] max-w-full rounded-xl object-contain", selected && "ring-2 ring-amber-500")}
        />
      ) : (
        <div className="flex h-32 items-center justify-center rounded-xl border text-muted-foreground">
          <LoaderIcon className="size-5 animate-spin" />
        </div>
      )}
    </NodeViewWrapper>
  );
}

function FileView({ node, selected }: ReactNodeViewProps) {
  const { fileId, encrypted, mimeType, name, size } = node.attrs as {
    fileId: string;
    encrypted: boolean;
    mimeType: string;
    name: string;
    size: number;
  };
  const { url } = useFileUrl(fileId, encrypted, mimeType);
  return (
    <NodeViewWrapper className="my-2" data-drag-handle>
      <a
        href={url ?? undefined}
        download={name}
        contentEditable={false}
        className={cn(
          "flex max-w-sm items-center gap-3 rounded-xl border bg-muted/40 p-3 no-underline hover:bg-muted",
          selected && "ring-2 ring-amber-500",
        )}
      >
        <FileIcon className="size-8 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{size ? formatBytes(size) : "File"}</span>
        </span>
      </a>
    </NodeViewWrapper>
  );
}

const fileAttrs = {
  fileId: { default: "" },
  encrypted: { default: false },
  mimeType: { default: "application/octet-stream" },
  name: { default: "" },
  size: { default: 0 },
};

/** A photo kept by id; the address is built from the id, never taken from the note. */
export const NoteImage = Node.create({
  name: "noteImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => fileAttrs,
  parseHTML: () => [{ tag: "note-image" }],
  renderHTML: ({ HTMLAttributes }) => ["note-image", mergeAttributes(HTMLAttributes)],
  addNodeView: () => ReactNodeViewRenderer(ImageView),
});

/** Any other file, shown as a card that downloads it. */
export const NoteFile = Node.create({
  name: "noteFile",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => fileAttrs,
  parseHTML: () => [{ tag: "note-file" }],
  renderHTML: ({ HTMLAttributes }) => ["note-file", mergeAttributes(HTMLAttributes)],
  addNodeView: () => ReactNodeViewRenderer(FileView),
});

"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { DownloadIcon, FileIcon, ImageOffIcon, LoaderIcon, PauseIcon, PlayIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

import { formatBytes } from "@/lib/documents/documents";
import { decryptBytes } from "@/lib/notes/lock";
import { NOTE_FILE_ID } from "@/lib/notes/notes";

import { useNoteKey } from "./note-key";

const fileUrl = (id: string) => (NOTE_FILE_ID.test(id) ? `/note-files/${id}` : null);

/** The file's bytes as a blob address, decrypting it first when it belongs to a locked note. */
export function useFileUrl(fileId: string, encrypted: boolean, mimeType: string, asBlob = false) {
  const { key } = useNoteKey();
  const fetched = encrypted || asBlob;
  const [url, setUrl] = useState<string | null>(fetched ? null : fileUrl(fileId));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!fetched) return;
    let made: string | null = null;
    let live = true;
    (async () => {
      const src = fileUrl(fileId);
      if (!src || (encrypted && !key)) throw new Error("locked");
      const res = await fetch(src);
      if (!res.ok) throw new Error("missing");
      const bytes = new Uint8Array(await res.arrayBuffer());
      const plain = encrypted && key ? await decryptBytes(key, bytes) : bytes;
      made = URL.createObjectURL(new Blob([plain], { type: mimeType }));
      if (live) setUrl(made);
    })().catch(() => live && setFailed(true));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [fileId, encrypted, fetched, mimeType, key]);
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

const clock = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** A voice note: play, pause, drag to a point, download. Plays from a blob, so phones can seek. */
function AudioView({ node, selected }: ReactNodeViewProps) {
  const { fileId, encrypted, mimeType, name, duration } = node.attrs as {
    fileId: string;
    encrypted: boolean;
    mimeType: string;
    name: string;
    duration: number;
  };
  const { url, failed } = useFileUrl(fileId, encrypted, mimeType, true);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState<number>(duration || 0);
  return (
    <NodeViewWrapper className="my-2" data-drag-handle>
      <div
        contentEditable={false}
        className={cn("flex max-w-sm items-center gap-3 rounded-xl border bg-muted/40 p-2.5 pr-3", selected && "ring-2 ring-amber-500")}
      >
        <button
          type="button"
          disabled={!url}
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => (playing ? audio.current?.pause() : void audio.current?.play())}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white disabled:opacity-50"
        >
          {!url && !failed ? (
            <LoaderIcon className="size-5 animate-spin" />
          ) : playing ? (
            <PauseIcon className="size-5 fill-current" />
          ) : (
            <PlayIcon className="size-5 translate-x-px fill-current" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium">{failed ? "Voice note could not be loaded" : name.replace(/\.\w+$/, "") || "Voice note"}</span>
          <input
            type="range"
            min={0}
            max={length || 1}
            step={0.1}
            value={Math.min(at, length || 1)}
            disabled={!url}
            aria-label="Position"
            onChange={(e) => {
              const v = Number(e.target.value);
              if (audio.current) audio.current.currentTime = v;
              setAt(v);
            }}
            className="h-1 w-full cursor-pointer accent-amber-500"
          />
          <span className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{clock(at)}</span>
            <span>{clock(length)}</span>
          </span>
        </div>
        {url && (
          <a href={url} download={name || "voice-note"} aria-label="Download voice note" className="text-muted-foreground hover:text-foreground">
            <DownloadIcon className="size-4" />
          </a>
        )}
        {url && (
          <audio
            ref={audio}
            src={url}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setAt(0);
            }}
            onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
            // Recordings from Chrome report no length until played through; the saved length is used then.
            onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLength(e.currentTarget.duration)}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

const fileAttrs = {
  fileId: { default: "" },
  encrypted: { default: false },
  mimeType: { default: "application/octet-stream" },
  name: { default: "" },
  size: { default: 0 },
  /** Seconds, for voice notes. */
  duration: { default: 0 },
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

/** A voice note recorded in the note, or an audio file added to it. */
export const NoteAudio = Node.create({
  name: "noteAudio",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => fileAttrs,
  parseHTML: () => [{ tag: "note-audio" }],
  renderHTML: ({ HTMLAttributes }) => ["note-audio", mergeAttributes(HTMLAttributes)],
  addNodeView: () => ReactNodeViewRenderer(AudioView),
});

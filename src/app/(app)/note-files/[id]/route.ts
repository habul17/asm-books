import { connection } from "next/server";

import { NOTE_IMAGE_TYPES } from "@/lib/notes/notes";
import { getCurrentUser } from "@/server/auth";
import { readNoteFile } from "@/server/notes";

/**
 * Sends a note's photo or file to the person who owns the note. Photos show in
 * the page; anything else only downloads, so an uploaded page can never run here.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in.", { status: 401 });
  const file = await readNoteFile((await params).id, user.id);
  if (!file) return new Response("Not found.", { status: 404 });
  const inline = !file.encrypted && NOTE_IMAGE_TYPES.has(file.mimeType);
  const name = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 100) || "file";
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": inline ? file.mimeType : "application/octet-stream",
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(file.name.slice(0, 100))}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

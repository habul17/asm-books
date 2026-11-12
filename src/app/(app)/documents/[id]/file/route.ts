import { connection } from "next/server";

import { downloadName, isDocumentMimeType } from "@/lib/documents/documents";
import { getCurrentUser } from "@/server/auth";
import { readDocumentFile } from "@/server/documents";

/**
 * Sends a stored file to a signed-in user. Files are private: there is no
 * public link, and a document marked "owner only" is "not found" for staff.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in.", { status: 401 });
  const file = await readDocumentFile(Number((await params).id), user);
  // Only the types we accept on upload are ever sent back.
  if (!file || !isDocumentMimeType(file.mimeType)) return new Response("Not found.", { status: 404 });

  const name = downloadName(file.title, file.mimeType);
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const download = new URL(request.url).searchParams.has("download");
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

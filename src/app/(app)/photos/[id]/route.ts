import { connection } from "next/server";

import { getCurrentUser } from "@/server/auth";
import { readProductPhoto } from "@/server/product-photos";

const IMAGE_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

/**
 * Sends a part's photo to a signed-in user. A photo's id is a hash of its bytes,
 * so the same address always means the same picture and the browser may keep it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  if (!(await getCurrentUser())) return new Response("Please sign in.", { status: 401 });
  const photo = await readProductPhoto((await params).id);
  if (!photo || !IMAGE_TYPES.has(photo.mimeType)) return new Response("Not found.", { status: 404 });
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.bytes.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

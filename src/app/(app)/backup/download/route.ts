import { connection } from "next/server";

import { getCurrentUser, isOwner } from "@/server/auth";
import { backupStream, recordBackupDownload } from "@/server/backup";
import { todayInIndia } from "@/server/invoice-writes";

/** Owner only: download all business data as one JSON file. */
export async function GET() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in.", { status: 401 });
  if (!isOwner(user)) return new Response("Only the owner can download backups.", { status: 403 });
  await recordBackupDownload(user);
  return new Response(backupStream(user), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="asm-books-backup-${todayInIndia()}.json"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

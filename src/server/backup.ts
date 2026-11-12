import "server-only";

import { eq, getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { settings } from "@/db/schema";

import type { CurrentUser } from "./auth";

const BACKUP_KEY = "backup";

/**
 * Sign-in secrets are never put in a downloaded file. Sessions are left out
 * completely, and so are the bytes of uploaded documents: they are too big for
 * this file (their names and details in `documents` are kept).
 */
const SKIP_TABLES = new Set(["sessions", "document_files"]);
const SKIP_COLUMNS: Record<string, string[]> = { users: ["passwordHash", "failedLogins", "lockedUntil"] };

/** Every table of the app, in schema order. */
function backupTables() {
  return (Object.values(schema) as unknown[])
    .filter((t): t is PgTable => is(t, PgTable))
    .filter((t) => !SKIP_TABLES.has(getTableName(t)));
}

/**
 * A readable copy of all business data as JSON, streamed table by table so
 * it never has to fit in memory at once.
 */
export function backupStream(user: CurrentUser): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const tables = backupTables();
  return new ReadableStream({
    async start(controller) {
      const write = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        const db = getDb();
        write(
          `{"app":"ASM Books","format":1,"createdAt":${JSON.stringify(new Date().toISOString())},` +
            `"createdBy":${JSON.stringify(user.username)},"note":"Passwords and uploaded document files are not included.","tables":{`,
        );
        for (const [i, table] of tables.entries()) {
          const name = getTableName(table);
          const skip = SKIP_COLUMNS[name] ?? [];
          const columns = Object.fromEntries(Object.entries(getTableColumns(table)).filter(([key]) => !skip.includes(key)));
          const rows = await db.select(columns).from(table);
          write(`${i ? "," : ""}${JSON.stringify(name)}:[`);
          rows.forEach((row, j) => write(`${j ? "," : ""}\n${JSON.stringify(row)}`));
          write("]");
        }
        write("}}\n");
        controller.close();
      } catch (err) {
        console.error("[backup] download failed:", err instanceof Error ? err.message : err);
        controller.error(new Error("Backup failed"));
      }
    },
  });
}

export interface BackupInfo {
  lastDownloadAt: string | null;
  lastDownloadBy: string | null;
  /** True when there is no download from the last 7 days. */
  stale?: boolean;
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export async function recordBackupDownload(user: CurrentUser) {
  const value: BackupInfo = { lastDownloadAt: new Date().toISOString(), lastDownloadBy: user.name };
  await getDb()
    .insert(settings)
    .values({ key: BACKUP_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function loadBackupInfo(): Promise<BackupInfo> {
  const [row] = await getDb().select({ value: settings.value }).from(settings).where(eq(settings.key, BACKUP_KEY));
  const v = (row?.value ?? {}) as Partial<BackupInfo>;
  const lastDownloadAt = typeof v.lastDownloadAt === "string" ? v.lastDownloadAt : null;
  return {
    lastDownloadAt,
    lastDownloadBy: typeof v.lastDownloadBy === "string" ? v.lastDownloadBy : null,
    stale: !lastDownloadAt || Date.now() - new Date(lastDownloadAt).getTime() > STALE_MS,
  };
}

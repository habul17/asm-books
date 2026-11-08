// Full backup of the database to your computer. Run it in your own terminal:
//
//   pnpm backup
//
// Saves a pg_dump file (exact, restorable with `pnpm restore`) in
// ~/Documents/ASM Books backups (or BACKUP_DIR), readable only by you.
// Keeps the newest 30 backups. Never prints the database address or password.

import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { pgEnv, redact } from "./pg-env";

const KEEP = 30;

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (expected in .env.local).");
  const env = { ...process.env, ...pgEnv(url) };
  delete env.DATABASE_URL;

  const dir = process.env.BACKUP_DIR || join(homedir(), "Documents", "ASM Books backups");
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const stamp = new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" })
    .replace(" ", "-")
    .replace(/:/g, "")
    .slice(0, 15); // 2026-11-08-1042
  const file = join(dir, `asm-books-${stamp}.dump`);
  const partial = `${file}.partial`;

  console.log("Backing up the database…");
  const dump = spawnSync(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-privileges", "--compress=6", `--file=${partial}`],
    { env, encoding: "utf8" },
  );
  if (dump.status !== 0) {
    rmSync(partial, { force: true });
    throw new Error(`pg_dump failed: ${redact(dump.stderr || dump.error?.message || "", env).trim()}`);
  }

  // Check the file can be read back before trusting it.
  const list = spawnSync("pg_restore", ["--list", partial], { encoding: "utf8" });
  const tables = (list.stdout.match(/ TABLE DATA /g) ?? []).length;
  if (list.status !== 0 || tables === 0) {
    rmSync(partial, { force: true });
    throw new Error("The backup file could not be read back, so it was deleted. Please try again.");
  }
  renameSync(partial, file);
  chmodSync(file, 0o600);

  const old = readdirSync(dir)
    .filter((f) => /^asm-books-.*\.dump$/.test(f))
    .sort()
    .reverse()
    .slice(KEEP);
  for (const f of old) rmSync(join(dir, f));

  const kb = Math.ceil(statSync(file).size / 1024);
  console.log(`Saved ${file} (${kb} KB, ${tables} tables).`);
  if (old.length) console.log(`Removed ${old.length} older backup(s); the newest ${KEEP} are kept.`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : "Backup failed.");
  process.exit(1);
}

// Restores a backup made by `pnpm backup` into an EMPTY database. Run it in your own terminal:
//
//   RESTORE_DATABASE_URL='postgresql://…new empty database…' pnpm restore <backup file>
//
// It refuses to touch a database that already has tables, so it can never
// overwrite live data. Create a new empty database (for example a new Neon
// project), restore into it, then point the app's DATABASE_URL at it.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";

import { pgEnv, redact } from "./pg-env";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function main() {
  const file = process.argv[2];
  if (!file || !existsSync(file)) throw new Error("Usage: pnpm restore <backup file from pnpm backup>");
  const url = process.env.RESTORE_DATABASE_URL;
  if (!url) throw new Error("Set RESTORE_DATABASE_URL to the new, empty database to restore into.");
  const env = { ...process.env, ...pgEnv(url) };
  delete env.DATABASE_URL;
  delete env.RESTORE_DATABASE_URL;

  const list = spawnSync("pg_restore", ["--list", file], { encoding: "utf8" });
  if (list.status !== 0) throw new Error("This is not a backup file from pnpm backup.");

  const check = spawnSync("psql", ["-X", "-At", "-c", "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"], {
    env,
    encoding: "utf8",
  });
  if (check.status !== 0) throw new Error(`Cannot reach the database: ${redact(check.stderr, env).trim()}`);
  const existing = Number(check.stdout.trim());
  if (existing !== 0) {
    throw new Error(`That database already has ${existing} table(s). Restore only goes into an empty database.`);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`Restore ${file} into database "${env.PGDATABASE}" on ${env.PGHOST}? Type yes: `)).trim();
  rl.close();
  if (answer !== "yes") return console.log("Nothing changed.");

  const restore = spawnSync(
    "pg_restore",
    ["--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction", `--dbname=${env.PGDATABASE ?? ""}`, file],
    { env, encoding: "utf8" },
  );
  if (restore.status !== 0) {
    throw new Error(`Restore failed and was rolled back: ${redact(restore.stderr, env).trim()}`);
  }
  console.log("Restored. Point DATABASE_URL at this database (in .env.local and on Vercel) to use it.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "Restore failed.");
  process.exit(1);
});

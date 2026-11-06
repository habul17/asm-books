#!/usr/bin/env node
// Verifies the database connection. Prints server details only, never credentials.
// Usage: pnpm db:check

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

try {
  const sql = neon(url);
  const started = Date.now();
  const [row] = await sql`SELECT version() AS version, current_database() AS db`;
  const ms = Date.now() - started;
  const version = row.version.split(" ").slice(0, 2).join(" ");
  console.log(`✓ Connected: ${version}, database "${row.db}", ${ms} ms`);
} catch (err) {
  // Error messages can include the host name; strip anything that looks like a URL.
  const message = String(err?.message ?? err).replace(/postgres(ql)?:\/\/\S+/gi, "[redacted]");
  console.error(`✖ Connection failed: ${message}`);
  process.exit(1);
}

import "server-only";

import { neon, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  return url;
}

const connect = () => drizzle({ client: neon(databaseUrl()), schema });

let instance: ReturnType<typeof connect> | undefined;

/**
 * Returns the shared database client, connecting on first use so that
 * builds (which never query) do not need credentials.
 * Each query is one HTTP request; use `db.batch` for several writes, or
 * `withTransaction` when later steps depend on earlier results.
 */
export function getDb() {
  instance ??= connect();
  return instance;
}

const connectPool = (pool: Pool) => drizzlePool({ client: pool, schema });
export type Tx = Parameters<Parameters<ReturnType<typeof connectPool>["transaction"]>[0]>[0];

/**
 * Runs `fn` in one database transaction: everything is saved, or nothing.
 * Opens a short-lived WebSocket connection, as recommended for serverless.
 */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: databaseUrl() });
  try {
    return await connectPool(pool).transaction(fn);
  } finally {
    await pool.end();
  }
}

export { schema };

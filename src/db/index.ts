import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  return drizzle({ client: neon(url), schema });
}

let instance: ReturnType<typeof connect> | undefined;

/**
 * Returns the shared database client, connecting on first use so that
 * builds (which never query) do not need credentials.
 */
export function getDb() {
  instance ??= connect();
  return instance;
}

export { schema };

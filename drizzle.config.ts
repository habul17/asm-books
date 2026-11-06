import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// Load local secrets for CLI commands; on Vercel the variables are already set.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  migrations: { table: "__drizzle_migrations", schema: "public" },
});

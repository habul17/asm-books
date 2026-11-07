// Creates a user, or resets a user's password. Run it in your own terminal:
//
//   pnpm user
//
// It asks for the details; the password is typed hidden and never printed,
// logged or stored anywhere except as a scrypt hash in the database.

import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";

import { neon } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../src/db/schema";
import { hashPassword, passwordProblem } from "../src/lib/auth/password";

const { users, sessions } = schema;

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/** Reads one line without showing what is typed. */
function askHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) throw new Error("Run this in a terminal so the password can be typed hidden.");
  process.stdout.write(question);
  return new Promise((resolve, reject) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          done();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          done();
          reject(new Error("Cancelled."));
          return;
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    const done = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (expected in .env.local).");
  const db = drizzle({ client: neon(url), schema });

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const username = (await rl.question("Username: ")).trim();
  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
    rl.close();
    throw new Error("Username must be 3-50 letters, digits, dots, dashes or underscores.");
  }

  const [existing] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(sql`lower(${users.username})`, username.toLowerCase()));

  let name = existing?.name ?? "";
  let role: "owner" | "staff" = "staff";
  if (existing) {
    const answer = (await rl.question(`"${username}" exists. Reset their password? (y/N) `)).trim().toLowerCase();
    if (answer !== "y") {
      rl.close();
      console.log("Nothing changed.");
      return;
    }
  } else {
    name = (await rl.question("Full name: ")).trim().slice(0, 100);
    if (!name) {
      rl.close();
      throw new Error("Name is required.");
    }
    const [{ total }] = await db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(users);
    if (total === 0) {
      role = "owner";
      console.log("This is the first user, so they will be the owner.");
    } else {
      const answer = (await rl.question("Role, owner or staff? (staff) ")).trim().toLowerCase();
      role = answer === "owner" ? "owner" : "staff";
    }
  }
  rl.close();

  const password = await askHidden("Password: ");
  const problem = passwordProblem(password, username);
  if (problem) throw new Error(problem);
  if ((await askHidden("Password again: ")) !== password) throw new Error("The passwords do not match.");

  const passwordHash = await hashPassword(password);
  if (existing) {
    await db.batch([
      db.update(users).set({ passwordHash, failedLogins: 0, lockedUntil: null }).where(eq(users.id, existing.id)),
      // Sign them out everywhere, in case the old password was known to someone else.
      db.delete(sessions).where(eq(sessions.userId, existing.id)),
    ]);
    console.log(`Password reset for "${username}". They are signed out on all devices.`);
  } else {
    await db.insert(users).values({ username, name, role, passwordHash });
    console.log(`Created ${role} "${username}".`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "Failed.");
  process.exit(1);
});

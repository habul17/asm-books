import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { isOwner, requireUser } from "@/server/auth";

const columns = {
  id: users.id,
  username: users.username,
  name: users.name,
  role: users.role,
  active: users.active,
  lastLoginAt: users.lastLoginAt,
  lockedUntil: users.lockedUntil,
  createdAt: users.createdAt,
};

/** Everyone who can sign in (owner only; null for staff). Password hashes never leave the server. */
export async function listUsers() {
  await connection(); // Always read live data; never prerender at build time.
  const me = await requireUser();
  if (!isOwner(me)) return null;
  const items = await getDb()
    .select(columns)
    .from(users)
    .orderBy(desc(users.active), sql`${users.role} = 'staff'`, asc(sql`lower(${users.name})`));
  return { me, items };
}

export type UserListItem = NonNullable<Awaited<ReturnType<typeof listUsers>>>["items"][number];

/** One user, for the owner's edit screen. Null when not found; "forbidden" for staff. */
export async function getUser(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  const me = await requireUser();
  if (!isOwner(me)) return "forbidden" as const;
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await getDb().select(columns).from(users).where(eq(users.id, id));
  return row ? { ...row, isMe: row.id === me.id } : null;
}

export type UserDetail = Exclude<NonNullable<Awaited<ReturnType<typeof getUser>>>, "forbidden">;

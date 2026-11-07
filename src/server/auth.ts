import "server-only";

import { and, eq, gt, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import {
  isSessionToken,
  newSessionToken,
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionIdFromToken,
} from "@/lib/auth/session-token";

export interface CurrentUser {
  id: number;
  name: string;
  username: string;
  role: "owner" | "staff";
}

/**
 * The signed-in user, or null. Checks the database every request (not just
 * the cookie), so signing out or switching a user off takes effect at once.
 * Wrapped in React `cache` so one request looks it up only once.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isSessionToken(token)) return null;
  const rows = await getDb()
    .select({ id: users.id, name: users.name, username: users.username, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(eq(sessions.id, sessionIdFromToken(token)), gt(sessions.expiresAt, sql`now()`), eq(users.active, true)),
    );
  return rows[0] ?? null;
});

/**
 * Use at the start of every data read and every Server Action.
 * Sends the visitor to the sign-in page when there is no valid session.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Starts a session for the user and sets the cookie. Call only from a Server Action. */
export async function startSession(userId: number, userAgent: string | null) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();
  await db.batch([
    // Tidy up this user's old sessions while we are here.
    db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, sql`now()`))),
    db.insert(sessions).values({
      id: sessionIdFromToken(token),
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 300) ?? null,
    }),
  ]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Ends the current session in the database and removes the cookie. */
export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (isSessionToken(token)) {
    await getDb().delete(sessions).where(eq(sessions.id, sessionIdFromToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { dummyHash, PASSWORD_MAX, verifyPassword } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/session-token";
import { endSession, startSession } from "@/server/auth";

export interface SignInState {
  error?: string;
}

/** Wrong passwords in a row before the account is locked for a while. */
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const WRONG = "Wrong username or password.";

const signInSchema = z.object({
  username: z.string().trim().min(1, "Enter your username.").max(100, WRONG),
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX, WRONG),
});

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? WRONG };
  const { username, password } = parsed.data;

  try {
    const db = getDb();
    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash, active: users.active, lockedUntil: users.lockedUntil })
      .from(users)
      .where(eq(sql`lower(${users.username})`, username.toLowerCase()));

    if (!user || !user.active) {
      // Spend the same time as a real check so response time does not reveal which usernames exist.
      await verifyPassword(password, await dummyHash());
      return { error: WRONG };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      return { error: `Too many wrong tries. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      // One atomic update, so parallel guesses cannot skip the lock.
      const reachesLimit = sql`${users.failedLogins} + 1 >= ${LOCK_AFTER}`;
      await db
        .update(users)
        .set({
          failedLogins: sql`CASE WHEN ${reachesLimit} THEN 0 ELSE ${users.failedLogins} + 1 END`,
          lockedUntil: sql`CASE WHEN ${reachesLimit} THEN now() + make_interval(mins => ${LOCK_MINUTES}) ELSE ${users.lockedUntil} END`,
        })
        .where(eq(users.id, user.id));
      return { error: WRONG };
    }

    await db
      .update(users)
      .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    await startSession(user.id, (await headers()).get("user-agent"));
  } catch (err) {
    console.error("[auth] sign-in failed:", err instanceof Error ? err.message : err);
    return { error: "Could not sign in. Please try again." };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOut() {
  try {
    await endSession();
  } catch (err) {
    console.error("[auth] sign-out failed:", err instanceof Error ? err.message : err);
  }
  redirect("/login");
}

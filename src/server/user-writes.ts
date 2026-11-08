import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import { getDb, withTransaction } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { NewUserInput, UserUpdateInput } from "@/lib/auth/user-validation";

/** A problem the person can fix; its message is safe to show. */
export class UserInputError extends Error {}

const USERNAME_TAKEN = "That username is already used. Pick another one.";

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "23505";

export async function createUser(input: NewUserInput): Promise<number> {
  const passwordHash = await hashPassword(input.password);
  try {
    const [row] = await getDb()
      .insert(users)
      .values({ username: input.username, name: input.name, role: input.role, passwordHash })
      .returning({ id: users.id });
    return row.id;
  } catch (err) {
    if (isUniqueViolation(err) || isUniqueViolation((err as { cause?: unknown })?.cause)) {
      throw new UserInputError(USERNAME_TAKEN);
    }
    throw err;
  }
}

/**
 * Change someone's name, role or whether they can sign in.
 * The shop always keeps at least one active owner, and owners cannot lock themselves out.
 */
export async function updateUser(id: number, input: UserUpdateInput, actingUserId: number) {
  if (id === actingUserId && (!input.active || input.role !== "owner")) {
    throw new UserInputError("You cannot switch yourself off or remove your own owner role. Ask another owner.");
  }
  await withTransaction(async (tx) => {
    // Lock the owners so two changes at once cannot remove the last one.
    const owners = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "owner"), eq(users.active, true)))
      .for("update");
    const [target] = await tx.select({ id: users.id }).from(users).where(eq(users.id, id)).for("update");
    if (!target) throw new UserInputError("This user no longer exists.");
    const losesOwner = owners.some((o) => o.id === id) && (!input.active || input.role !== "owner");
    if (losesOwner && owners.length <= 1) throw new UserInputError("There must always be at least one active owner.");

    await tx.update(users).set({ name: input.name, role: input.role, active: input.active }).where(eq(users.id, id));
    // Switched off: sign them out everywhere at once.
    if (!input.active) await tx.delete(sessions).where(eq(sessions.userId, id));
  });
}

/** The owner sets a new password for someone; they are signed out on every device and unlocked. */
export async function resetPassword(id: number, password: string) {
  const passwordHash = await hashPassword(password);
  const db = getDb();
  const [updated] = await db.batch([
    db
      .update(users)
      .set({ passwordHash, failedLogins: 0, lockedUntil: null })
      .where(eq(users.id, id))
      .returning({ id: users.id }),
    db.delete(sessions).where(eq(sessions.userId, id)),
  ]);
  if (updated.length === 0) throw new UserInputError("This user no longer exists.");
}

/** A user changes their own password. Other devices are signed out; this one stays signed in. */
export async function changeOwnPassword(userId: number, current: string, password: string, keepSessionId: string | null) {
  const db = getDb();
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!row || !(await verifyPassword(current, row.hash))) throw new UserInputError("Your current password is wrong.");
  const passwordHash = await hashPassword(password);
  await db.batch([
    db.update(users).set({ passwordHash, failedLogins: 0, lockedUntil: null }).where(eq(users.id, userId)),
    db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), keepSessionId ? ne(sessions.id, keepSessionId) : sql`true`)),
  ]);
}

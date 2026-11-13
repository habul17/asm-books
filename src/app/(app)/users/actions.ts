"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseNewUser, parsePasswordChange, parsePasswordReset, parseUserUpdate } from "@/lib/auth/user-validation";
import { currentSessionId, isOwner, requireUser } from "@/server/auth";
import { getUser } from "@/server/users";
import { changeOwnPassword, createUser, resetPassword, updateUser, UserInputError } from "@/server/user-writes";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();
const ONLY_OWNER = "Only the owner can manage users.";
const fields = (formData: FormData) => Object.fromEntries(formData.entries());

function failure(action: string, err: unknown): ActionState {
  if (err instanceof UserInputError) return { error: err.message };
  // Never log the form: it holds passwords.
  console.error(`[users] ${action} failed:`, err instanceof Error ? err.message : "unknown error");
  return { error: "Could not save. Please try again." };
}

export async function addUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser();
  if (!isOwner(me)) return { error: ONLY_OWNER };
  const parsed = parseNewUser(fields(formData));
  if (parsed.error !== undefined) return { error: parsed.error };
  let id: number;
  try {
    id = await createUser(parsed.value);
  } catch (err) {
    return failure("create", err);
  }
  redirect(`/users/${id}`);
}

export async function saveUser(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser();
  if (!isOwner(me)) return { error: ONLY_OWNER };
  if (!idSchema.safeParse(id).success) return { error: "User not found." };
  const parsed = parseUserUpdate(fields(formData));
  if (parsed.error !== undefined) return { error: parsed.error };
  try {
    await updateUser(id, parsed.value, me.id);
  } catch (err) {
    return failure("update", err);
  }
  refresh();
  return { ok: true };
}

export async function setUserPassword(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser();
  if (!isOwner(me)) return { error: ONLY_OWNER };
  if (!idSchema.safeParse(id).success) return { error: "User not found." };
  const user = await getUser(id);
  if (!user || user === "forbidden") return { error: "User not found." };
  if (user.isMe) return { error: "Change your own password from My account." };
  const parsed = parsePasswordReset(fields(formData), user.username);
  if (parsed.error !== undefined) return { error: parsed.error };
  try {
    await resetPassword(id, parsed.value);
  } catch (err) {
    return failure("reset password", err);
  }
  refresh();
  return { ok: true };
}

export async function changeMyPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireUser();
  // Only the owner sets passwords; staff ask the owner (Users → their name → Set new password).
  if (me.role !== "owner") return { error: "Only the owner can change passwords. Ask the owner." };
  const parsed = parsePasswordChange(fields(formData), me.username);
  if (parsed.error !== undefined) return { error: parsed.error };
  try {
    await changeOwnPassword(me.id, parsed.value.current, parsed.value.password, await currentSessionId());
  } catch (err) {
    return failure("change own password", err);
  }
  return { ok: true };
}

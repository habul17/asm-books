"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseTaskInput } from "@/lib/tasks/tasks";
import { requireUser } from "@/server/auth";
import { createTask, deleteTask, setTaskDone, TaskError, updateTask } from "@/server/tasks";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const idSchema = z.number().int().positive();

function failure(action: string, err: unknown): ActionState {
  if (err instanceof TaskError) return { error: err.message };
  console.error(`[tasks] ${action} failed:`, err instanceof Error ? err.message : err);
  return { error: "Could not save. Please try again." };
}

/** Adds a task from the box on the Tasks screen and stays there. */
export async function addTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseTaskInput(formData);
  if (parsed.error !== undefined) return { error: parsed.error };
  try {
    await createTask(parsed.value, user.id);
  } catch (err) {
    return failure("add", err);
  }
  refresh();
  return { ok: true };
}

/** Saves changes to a task, then returns to the list. */
export async function saveTask(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Task not found." };
  const parsed = parseTaskInput(formData);
  if (parsed.error !== undefined) return { error: parsed.error };
  try {
    await updateTask(id, parsed.value);
  } catch (err) {
    return failure("save", err);
  }
  redirect("/tasks");
}

export async function toggleTask(id: number, done: boolean): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success || typeof done !== "boolean") return { error: "Task not found." };
  try {
    await setTaskDone(id, done, user.id);
  } catch (err) {
    return failure("tick", err);
  }
  refresh();
  return { ok: true };
}

export async function deleteTaskAction(id: number): Promise<ActionState> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Task not found." };
  try {
    await deleteTask(id, user);
  } catch (err) {
    return failure("delete", err);
  }
  redirect("/tasks");
}

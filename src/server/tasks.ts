import "server-only";

import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { connection } from "next/server";

import { getDb } from "@/db";
import { tasks, users } from "@/db/schema";
import type { TaskInput } from "@/lib/tasks/tasks";
import { isOwner, requireUser, type CurrentUser } from "@/server/auth";

import { todayInIndia } from "./invoice-writes";

/** A problem with what the user entered; the message is safe to show. */
export class TaskError extends Error {}

/** How many finished tasks the screen keeps showing. */
const DONE_SHOWN = 30;
const OPEN_LIMIT = 500;

const assignees = alias(users, "assignees");
const doers = alias(users, "doers");

const columns = {
  id: tasks.id,
  title: tasks.title,
  notes: tasks.notes,
  dueDate: tasks.dueDate,
  assignedTo: tasks.assignedTo,
  assignedName: assignees.name,
  done: tasks.done,
  doneAt: tasks.doneAt,
  doneByName: doers.name,
  createdBy: tasks.createdBy,
};

const taskRows = () =>
  getDb()
    .select(columns)
    .from(tasks)
    .leftJoin(assignees, eq(assignees.id, tasks.assignedTo))
    .leftJoin(doers, eq(doers.id, tasks.doneBy));

/** Open tasks and the most recently finished ones. Everyone who signs in sees every task. */
export async function listTasks() {
  await connection(); // Always read live data; never prerender at build time.
  const user = await requireUser();
  const [open, done] = await Promise.all([
    taskRows().where(eq(tasks.done, false)).orderBy(asc(tasks.dueDate), asc(tasks.id)).limit(OPEN_LIMIT),
    taskRows().where(eq(tasks.done, true)).orderBy(desc(tasks.doneAt), desc(tasks.id)).limit(DONE_SHOWN),
  ]);
  return { today: todayInIndia(), userId: user.id, open, done };
}

export type TaskItem = Awaited<ReturnType<typeof listTasks>>["open"][number];

export async function getTask(id: number) {
  await connection(); // Always read live data; never prerender at build time.
  await requireUser();
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const [row] = await taskRows().where(eq(tasks.id, id));
  return row ?? null;
}

/** People a task can be given to: everyone who can sign in. */
export async function taskPeople() {
  await requireUser();
  return getDb().select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name));
}

/**
 * Open tasks due today or earlier that concern this user: their own, those
 * for anyone, and for the owner all of them. No auth check: the caller has
 * checked the user.
 */
export async function loadDueTasks(user: CurrentUser, today: string) {
  return getDb()
    .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, assignedName: assignees.name })
    .from(tasks)
    .leftJoin(assignees, eq(assignees.id, tasks.assignedTo))
    .where(
      and(
        eq(tasks.done, false),
        lte(tasks.dueDate, today),
        isOwner(user) ? undefined : or(isNull(tasks.assignedTo), eq(tasks.assignedTo, user.id)),
      ),
    )
    .orderBy(asc(tasks.dueDate), asc(tasks.id))
    .limit(100);
}

/** The task's columns from the form. The chosen person must be someone who can sign in. */
async function values(input: TaskInput) {
  if (input.assignedTo != null) {
    const [person] = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.assignedTo), eq(users.active, true)));
    if (!person) throw new TaskError("That person cannot be chosen. Please pick again.");
  }
  return { title: input.title, notes: input.notes || null, dueDate: input.dueDate, assignedTo: input.assignedTo };
}

export async function createTask(input: TaskInput, userId: number): Promise<number> {
  const [{ id }] = await getDb()
    .insert(tasks)
    .values({ ...(await values(input)), createdBy: userId })
    .returning({ id: tasks.id });
  return id;
}

export async function updateTask(id: number, input: TaskInput): Promise<void> {
  const changed = await getDb()
    .update(tasks)
    .set(await values(input))
    .where(eq(tasks.id, id))
    .returning({ id: tasks.id });
  if (changed.length === 0) throw new TaskError("Task not found.");
}

/** Ticks a task off, or opens it again. */
export async function setTaskDone(id: number, done: boolean, userId: number): Promise<void> {
  const changed = await getDb()
    .update(tasks)
    .set(done ? { done: true, doneAt: sql`now()`, doneBy: userId } : { done: false, doneAt: null, doneBy: null })
    .where(eq(tasks.id, id))
    .returning({ id: tasks.id });
  if (changed.length === 0) throw new TaskError("Task not found.");
}

/** Removes a task for good. The owner can remove any task; staff only the ones they added. */
export async function deleteTask(id: number, user: CurrentUser): Promise<void> {
  const removed = await getDb()
    .delete(tasks)
    .where(and(eq(tasks.id, id), isOwner(user) ? undefined : eq(tasks.createdBy, user.id)))
    .returning({ id: tasks.id });
  if (removed.length === 0) throw new TaskError("Only the owner or the person who added this task can delete it.");
}

// Tasks: a to-do list for the shop.

import { z } from "zod";

import { isIsoDate } from "@/lib/reports/period";

const taskSchema = z.object({
  title: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""),
    z.string().min(1, "Write what needs to be done").max(200, "The task can be at most 200 characters"),
  ),
  notes: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(1000, "Notes can be at most 1000 characters")),
  dueDate: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v : null),
    z.string().refine(isIsoDate, "Enter a valid date").nullable(),
  ),
  /** Who should do it; null is anyone. */
  assignedTo: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number({ error: "Choose a person from the list" }).int().positive().nullable(),
  ),
});

export type TaskInput = z.infer<typeof taskSchema>;

export function parseTaskInput(form: FormData | Record<string, unknown>): { value: TaskInput; error?: never } | { error: string; value?: never } {
  const parsed = taskSchema.safeParse(form instanceof FormData ? Object.fromEntries(form) : form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the details." };
  return { value: parsed.data };
}

export type TaskWhen = "overdue" | "today" | "later" | "someday";

export const TASK_WHEN_LABELS: Record<TaskWhen, string> = {
  overdue: "Overdue",
  today: "Today",
  later: "Coming up",
  someday: "No date",
};

/** Where an open task stands against today. */
export function taskWhen(dueDate: string | null, today: string): TaskWhen {
  if (dueDate == null) return "someday";
  return dueDate < today ? "overdue" : dueDate === today ? "today" : "later";
}

const ORDER: TaskWhen[] = ["overdue", "today", "later", "someday"];

/** Open tasks in the order to do them: overdue, today, coming up (soonest first), then those with no date. */
export function groupTasks<T extends { dueDate: string | null; id: number }>(tasks: T[], today: string): { when: TaskWhen; tasks: T[] }[] {
  const groups = new Map<TaskWhen, T[]>(ORDER.map((w) => [w, []]));
  for (const t of tasks) groups.get(taskWhen(t.dueDate, today))!.push(t);
  for (const list of groups.values()) list.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.id - b.id);
  return ORDER.map((when) => ({ when, tasks: groups.get(when)! })).filter((g) => g.tasks.length > 0);
}

/** A task counts as a reminder for a user when it is due and is theirs, anyone's, or they are the owner. */
export function remindsUser(
  task: { dueDate: string | null; assignedTo: number | null },
  user: { id: number; role: "owner" | "staff" },
  today: string,
): boolean {
  if (task.dueDate == null || task.dueDate > today) return false;
  return user.role === "owner" || task.assignedTo == null || task.assignedTo === user.id;
}

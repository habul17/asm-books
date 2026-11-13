import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "cn";

import { AddTaskForm } from "@/components/tasks/task-form";
import { TaskTick } from "@/components/tasks/task-tick";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { groupTasks, TASK_WHEN_LABELS } from "@/lib/tasks/tasks";
import { listTasks, taskPeople, type TaskItem } from "@/server/tasks";

export const metadata: Metadata = { title: "Tasks" };

function TaskRow({ task, overdue = false }: { task: TaskItem; overdue?: boolean }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <TaskTick id={task.id} done={task.done} title={task.title} />
      <Link href={`/tasks/${task.id}/edit`} className="flex min-w-0 flex-1 flex-col gap-0.5 hover:underline">
        <span className={cn("font-medium break-words", task.done && "text-muted-foreground line-through")}>{task.title}</span>
        <span className={cn("text-xs text-muted-foreground", overdue && "font-medium text-destructive")}>
          {[
            task.dueDate ? `${task.done ? "Was due" : "Do by"} ${formatDate(task.dueDate)}` : null,
            task.assignedName ? `For ${task.assignedName}` : null,
            task.done && task.doneByName ? `Done by ${task.doneByName}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "No date"}
        </span>
        {task.notes && <span className="line-clamp-2 text-xs whitespace-pre-line text-muted-foreground">{task.notes}</span>}
      </Link>
    </li>
  );
}

async function Add() {
  return <AddTaskForm people={await taskPeople()} />;
}

async function Lists() {
  const { today, open, done } = await listTasks();
  const groups = groupTasks(open, today);
  return (
    <>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing to do. Add a task above.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.when} className="flex flex-col gap-2">
            <h2 className={cn("px-1 text-sm font-semibold text-muted-foreground", g.when === "overdue" && "text-destructive")}>
              {TASK_WHEN_LABELS[g.when]} ({g.tasks.length})
            </h2>
            <ul className="flex flex-col divide-y rounded-xl border">
              {g.tasks.map((t) => (
                <TaskRow key={t.id} task={t} overdue={g.when === "overdue"} />
              ))}
            </ul>
          </section>
        ))
      )}
      {done.length > 0 && (
        <details className="flex flex-col gap-2">
          <summary className="cursor-pointer px-1 text-sm font-semibold text-muted-foreground">Done lately ({done.length})</summary>
          <ul className="mt-2 flex flex-col divide-y rounded-xl border">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export default function TasksPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <h1 className="text-xl font-semibold">Tasks</h1>
      <Suspense fallback={<Skeleton className="h-44 rounded-xl" />}>
        <Add />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <Lists />
      </Suspense>
      <p className="text-xs text-muted-foreground">
        Everyone who signs in sees every task. A task with a date shows on the bell on that day, for the person it is for.
      </p>
    </div>
  );
}

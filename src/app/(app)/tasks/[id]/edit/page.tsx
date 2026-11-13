import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditTaskForm } from "@/components/tasks/task-form";
import { Skeleton } from "@/components/ui/skeleton";
import { isOwner, requireUser } from "@/server/auth";
import { getTask, taskPeople } from "@/server/tasks";

export const metadata: Metadata = { title: "Edit task" };

async function Form({ params }: { params: PageProps<"/tasks/[id]/edit">["params"] }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [task, people, user] = await Promise.all([getTask(id), taskPeople(), requireUser()]);
  if (!task) notFound();
  // Someone switched off since they were given the task still shows, so saving does not drop them silently.
  const listed =
    task.assignedTo != null && task.assignedName && !people.some((p) => p.id === task.assignedTo)
      ? [...people, { id: task.assignedTo, name: `${task.assignedName} (switched off)` }]
      : people;
  return (
    <EditTaskForm
      id={task.id}
      initial={{ title: task.title, notes: task.notes ?? "", dueDate: task.dueDate ?? "", assignedTo: task.assignedTo }}
      people={listed}
      canDelete={isOwner(user) || task.createdBy === user.id}
    />
  );
}

export default function EditTaskPage({ params }: PageProps<"/tasks/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link href="/tasks" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Tasks
      </Link>
      <h1 className="text-xl font-semibold">Edit task</h1>
      <Suspense fallback={<Skeleton className="h-72" />}>
        <Form params={params} />
      </Suspense>
    </div>
  );
}

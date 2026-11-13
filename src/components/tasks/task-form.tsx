"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { addTask, deleteTaskAction, saveTask } from "@/app/(app)/tasks/actions";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export interface TaskPerson {
  id: number;
  name: string;
}

function PersonSelect({ id, people, defaultValue }: { id: string; people: TaskPerson[]; defaultValue?: number | null }) {
  return (
    <NativeSelect id={id} name="assignedTo" defaultValue={defaultValue == null ? "" : String(defaultValue)} className="w-full">
      <NativeSelectOption value="">Anyone</NativeSelectOption>
      {people.map((p) => (
        <NativeSelectOption key={p.id} value={p.id}>
          {p.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** The quick box at the top of the Tasks screen; it clears itself once the task is added. */
export function AddTaskForm({ people }: { people: TaskPerson[] }) {
  const { state, pending, onSubmit, onChange, dirty, formRef } = useSaveForm(addTask, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-3 rounded-xl border p-4">
      <Field label="New task" htmlFor="t-title">
        <Input
          id="t-title"
          name="title"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Call a customer, pay a bill, order a part…"
          className="h-10"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Do by (optional)" htmlFor="t-due">
          <Input id="t-due" name="dueDate" type="date" className="h-10" />
        </Field>
        <Field label="For" htmlFor="t-for">
          <PersonSelect id="t-for" people={people} />
        </Field>
      </div>
      <SaveRow state={state} pending={pending} dirty={dirty} label="Add task" />
    </form>
  );
}

/** The full form for changing a task, with delete. */
export function EditTaskForm({
  id,
  initial,
  people,
  canDelete,
}: {
  id: number;
  initial: { title: string; notes: string; dueDate: string; assignedTo: number | null };
  people: TaskPerson[];
  /** The owner, or the person who added the task. */
  canDelete: boolean;
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveTask.bind(null, id));
  const [deleting, startDelete] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <form onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-5">
      <Field label="Task" htmlFor="t-title">
        <Input id="t-title" name="title" required maxLength={200} autoComplete="off" defaultValue={initial.title} className="h-10" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Do by (optional)" htmlFor="t-due">
          <Input id="t-due" name="dueDate" type="date" defaultValue={initial.dueDate} className="h-10" />
        </Field>
        <Field label="For" htmlFor="t-for">
          <PersonSelect id="t-for" people={people} defaultValue={initial.assignedTo} />
        </Field>
      </div>
      <Field label="Notes (optional)" htmlFor="t-notes">
        <Textarea id="t-notes" name="notes" maxLength={1000} rows={3} defaultValue={initial.notes} />
      </Field>
      <SaveRow state={state} pending={pending} dirty={dirty} label="Save changes">
        <Link href="/tasks" className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </SaveRow>

      {canDelete && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4 text-sm">
          {confirming ? (
            <>
              <span>Delete this task for good?</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    const result = await deleteTaskAction(id);
                    if (result?.error) setDeleteError(result.error);
                  })
                }
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirming(false)}>
                No, keep it
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirming(true)}>
              Delete task
            </Button>
          )}
          {deleteError && (
            <span role="alert" className="text-destructive">
              {deleteError}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

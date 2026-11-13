# Tasks

A simple to-do list for the shop: call a customer, pay a bill, order a part.

## Using it

- Type the task in the box at the top and press **Add task**. A date and a
  person are optional.
- Press the round box beside a task to mark it done. Press it again under
  "Done lately" to open it again.
- Press the task itself to change it, add notes or delete it.

Open tasks are listed in the order to do them: overdue, today, coming up,
then those with no date. The last 30 finished tasks stay under "Done lately".

## Who sees what

- Everyone who signs in sees every task and can add, change and tick any of
  them. Do not put private things in a task.
- The owner can delete any task. Staff can delete only the tasks they added.
- A task with a date shows on the bell and in Reminders from that day until
  it is done. Staff are reminded of their own tasks and of tasks for
  "Anyone"; the owner is reminded of all of them.

## For developers

- Table `tasks` (migration `0021`).
- `src/lib/tasks/tasks.ts`: form rules and ordering, with unit tests.
- `src/server/tasks.ts`: reads and writes; `loadDueTasks` feeds the bell.

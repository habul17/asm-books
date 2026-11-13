import { describe, expect, it } from "vitest";

import { groupTasks, parseTaskInput, remindsUser, taskWhen } from "./tasks";

describe("parseTaskInput", () => {
  it("cleans a normal task", () => {
    expect(parseTaskInput({ title: "  Call   Murugan  about payment ", notes: "", dueDate: "2026-11-20", assignedTo: "3" })).toEqual({
      value: { title: "Call Murugan about payment", notes: "", dueDate: "2026-11-20", assignedTo: 3 },
    });
    expect(parseTaskInput({ title: "Order brake pads" }).value).toEqual({
      title: "Order brake pads",
      notes: "",
      dueDate: null,
      assignedTo: null,
    });
  });

  it("reads FormData too", () => {
    const fd = new FormData();
    fd.set("title", "Pay rent");
    fd.set("dueDate", "");
    fd.set("assignedTo", "");
    expect(parseTaskInput(fd).value).toMatchObject({ title: "Pay rent", dueDate: null, assignedTo: null });
  });

  it.each([
    [{ title: "   " }, "Write what needs to be done"],
    [{ title: "x".repeat(201) }, "The task can be at most 200 characters"],
    [{ dueDate: "20/11/2026" }, "Enter a valid date"],
    [{ assignedTo: "someone" }, "Choose a person from the list"],
    [{ notes: "x".repeat(1001) }, "Notes can be at most 1000 characters"],
  ])("rejects %j", (change, error) => {
    expect(parseTaskInput({ title: "Pay rent", ...change })).toEqual({ error });
  });
});

describe("taskWhen and groupTasks", () => {
  const today = "2026-11-13";
  it("places a task against today", () => {
    expect(taskWhen("2026-11-12", today)).toBe("overdue");
    expect(taskWhen("2026-11-13", today)).toBe("today");
    expect(taskWhen("2026-11-14", today)).toBe("later");
    expect(taskWhen(null, today)).toBe("someday");
  });

  it("orders tasks: overdue, today, coming up, no date", () => {
    const tasks = [
      { id: 1, dueDate: null },
      { id: 2, dueDate: "2026-12-01" },
      { id: 3, dueDate: "2026-11-13" },
      { id: 4, dueDate: "2026-11-01" },
      { id: 5, dueDate: "2026-11-20" },
      { id: 6, dueDate: "2026-10-01" },
    ];
    expect(groupTasks(tasks, today).map((g) => [g.when, g.tasks.map((t) => t.id)])).toEqual([
      ["overdue", [6, 4]],
      ["today", [3]],
      ["later", [5, 2]],
      ["someday", [1]],
    ]);
    expect(groupTasks([], today)).toEqual([]);
  });
});

describe("remindsUser", () => {
  const today = "2026-11-13";
  const owner = { id: 1, role: "owner" as const };
  const staff = { id: 2, role: "staff" as const };
  it("reminds only when the task is due", () => {
    expect(remindsUser({ dueDate: null, assignedTo: null }, owner, today)).toBe(false);
    expect(remindsUser({ dueDate: "2026-11-14", assignedTo: null }, owner, today)).toBe(false);
    expect(remindsUser({ dueDate: "2026-11-13", assignedTo: null }, owner, today)).toBe(true);
  });
  it("reminds staff of their own tasks and of tasks for anyone", () => {
    expect(remindsUser({ dueDate: "2026-11-01", assignedTo: 2 }, staff, today)).toBe(true);
    expect(remindsUser({ dueDate: "2026-11-01", assignedTo: null }, staff, today)).toBe(true);
    expect(remindsUser({ dueDate: "2026-11-01", assignedTo: 1 }, staff, today)).toBe(false);
    expect(remindsUser({ dueDate: "2026-11-01", assignedTo: 2 }, owner, today)).toBe(true);
  });
});

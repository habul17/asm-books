import { describe, expect, it } from "vitest";

import { settleOldestFirst } from "./pay-status";

const TODAY = "2026-11-15";
const bill = (id: number, date: string, total: number, dueDate: string | null = null) => ({ id, date, dueDate, total });

describe("settleOldestFirst", () => {
  it("marks a bill partly paid when only some money came in", () => {
    const s = settleOldestFirst([bill(1, "2026-10-30", 6632, "2026-11-15")], 2632, 0, TODAY);
    expect(s.get(1)).toEqual({ status: "part-paid", paid: 2632, due: 4000 });
  });

  it("settles the oldest bill first", () => {
    const s = settleOldestFirst([bill(2, "2026-11-06", 300), bill(1, "2026-10-31", 500)], 600, 0, TODAY);
    expect(s.get(1)).toEqual({ status: "paid", paid: 500, due: 0 });
    expect(s.get(2)).toEqual({ status: "part-paid", paid: 100, due: 200 });
  });

  it("uses the bill id to order bills of the same day", () => {
    const s = settleOldestFirst([bill(5, "2026-11-11", 100), bill(4, "2026-11-11", 100)], 100, 0, TODAY);
    expect(s.get(4)?.status).toBe("paid");
    expect(s.get(5)?.status).toBe("unpaid");
  });

  it("shows overdue once the due date has passed and money is still to come", () => {
    const s = settleOldestFirst([bill(1, "2026-11-03", 9440, "2026-11-03")], 0, 0, TODAY);
    expect(s.get(1)).toEqual({ status: "overdue", paid: 0, due: 9440 });
  });

  it("is not overdue on the due date itself", () => {
    const s = settleOldestFirst([bill(1, "2026-11-01", 100, TODAY)], 0, 0, TODAY);
    expect(s.get(1)?.status).toBe("unpaid");
  });

  it("is paid even when past the due date", () => {
    const s = settleOldestFirst([bill(1, "2026-11-01", 100, "2026-11-02")], 100, 0, TODAY);
    expect(s.get(1)?.status).toBe("paid");
  });

  it("settles an old opening balance before the bills", () => {
    const s = settleOldestFirst([bill(1, "2026-11-01", 100)], 150, 100, TODAY);
    expect(s.get(1)).toEqual({ status: "part-paid", paid: 50, due: 50 });
  });

  it("counts money paid in advance towards the bills", () => {
    const s = settleOldestFirst([bill(1, "2026-11-01", 100)], 0, -100, TODAY);
    expect(s.get(1)?.status).toBe("paid");
  });

  it("keeps paise exact", () => {
    const s = settleOldestFirst([bill(1, "2026-11-01", 0.3), bill(2, "2026-11-02", 0.3)], 0.6, 0, TODAY);
    expect(s.get(2)).toEqual({ status: "paid", paid: 0.3, due: 0 });
  });
});

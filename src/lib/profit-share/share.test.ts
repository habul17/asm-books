import { describe, expect, it } from "vitest";

import {
  expenseDates,
  hasEnded,
  parseShareExpense,
  readShareExpenses,
  scheduleLabel,
  scheduleSentence,
  shareProfit,
  type ShareExpense,
} from "./share";

const expense = (over: Partial<ShareExpense> = {}): ShareExpense => ({
  id: "e1",
  name: "Shop rent",
  ashi: 1500,
  dad: 1500,
  repeat: "monthly",
  start: "2026-11-01",
  end: null,
  ...over,
});

describe("expenseDates", () => {
  it("takes a monthly expense off on the 1st of every month from its start", () => {
    expect(expenseDates(expense(), "2026-11-01", "2026-11-25")).toEqual(["2026-11-01"]);
    expect(expenseDates(expense(), "2026-06-01", "2027-01-31")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });

  it("starts mid-month on the start date, then moves to the 1st", () => {
    const e = expense({ start: "2026-11-15" });
    expect(expenseDates(e, "2026-11-01", "2026-11-14")).toEqual([]);
    expect(expenseDates(e, "2026-11-01", "2026-11-30")).toEqual(["2026-11-15"]);
    expect(expenseDates(e, "2026-11-01", "2027-01-10")).toEqual(["2026-11-15", "2026-12-01", "2027-01-01"]);
  });

  it("stops at the end date", () => {
    const e = expense({ end: "2027-01-31" });
    expect(expenseDates(e, "2026-01-01", "2027-12-31")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
    // An end date part way through a month still counts that month (it came off on the 1st).
    expect(expenseDates(expense({ end: "2026-12-10" }), "2026-11-01", "2027-03-31")).toEqual(["2026-11-01", "2026-12-01"]);
  });

  it("counts only the days inside the period", () => {
    expect(expenseDates(expense(), "2026-12-02", "2026-12-31")).toEqual([]);
    expect(expenseDates(expense(), "2026-12-01", "2026-12-01")).toEqual(["2026-12-01"]);
    expect(expenseDates(expense(), "2026-10-01", "2026-10-31")).toEqual([]);
  });

  it("takes a one-time expense off on its date only", () => {
    const e = expense({ repeat: "once", start: "2026-11-05" });
    expect(expenseDates(e, "2026-11-01", "2026-11-30")).toEqual(["2026-11-05"]);
    expect(expenseDates(e, "2026-12-01", "2027-06-30")).toEqual([]);
  });

  it("never counts a monthly expense that ends before it starts", () => {
    expect(expenseDates(expense({ end: "2026-10-01" }), "2026-01-01", "2027-12-31")).toEqual([]);
  });
});

describe("shareProfit", () => {
  it("splits the profit half and half and takes each one's expenses off", () => {
    const s = shareProfit(12000, [expense()], "2026-11-01", "2026-11-25");
    expect(s.ashi).toEqual({ share: 6000, expenses: 1500, final: 4500 });
    expect(s.dad).toEqual({ share: 6000, expenses: 1500, final: 4500 });
    expect(s.counted).toEqual({ e1: 1 });
  });

  it("keeps each partner's expenses apart", () => {
    const s = shareProfit(
      10000,
      [expense({ ashi: 500, dad: 0 }), expense({ id: "e2", ashi: 0, dad: 2000, repeat: "once", start: "2026-11-20" })],
      "2026-11-01",
      "2026-11-30",
    );
    expect(s.ashi).toEqual({ share: 5000, expenses: 500, final: 4500 });
    expect(s.dad).toEqual({ share: 5000, expenses: 2000, final: 3000 });
  });

  it("takes a monthly expense off once for every month in the period", () => {
    const s = shareProfit(60000, [expense({ start: "2026-06-01" })], "2026-06-01", "2026-11-25");
    expect(s.ashi).toEqual({ share: 30000, expenses: 9000, final: 21000 });
    expect(s.counted).toEqual({ e1: 6 });
  });

  it("gives the odd paisa to Dad, as before, and can go below zero", () => {
    expect(shareProfit(100.01, [], "2026-11-01", "2026-11-30").ashi.share).toBe(50.01);
    expect(shareProfit(100.01, [], "2026-11-01", "2026-11-30").dad.share).toBe(50);
    expect(shareProfit(1000, [expense()], "2026-11-01", "2026-11-30").ashi.final).toBe(-1000);
  });

  it("leaves out expenses that do not fall in the period", () => {
    const s = shareProfit(1000, [expense({ start: "2027-01-01" })], "2026-11-01", "2026-11-30");
    expect(s.ashi).toEqual({ share: 500, expenses: 0, final: 500 });
    expect(s.counted).toEqual({});
  });
});

describe("schedule text", () => {
  it("describes when an expense comes off", () => {
    expect(scheduleLabel(expense())).toBe("Every month from 01-11-2026");
    expect(scheduleLabel(expense({ end: "2027-01-31" }))).toBe("Every month from 01-11-2026 to 31-01-2027");
    expect(scheduleLabel(expense({ repeat: "once", start: "2026-11-05" }))).toBe("Once, on 05-11-2026");
    expect(scheduleSentence(expense())).toBe("Comes off on the 1st of every month, from 01-11-2026.");
    expect(scheduleSentence(expense({ start: "2026-11-25", end: "2027-01-31" }))).toBe(
      "Comes off on 25-11-2026, then on the 1st of every month until 31-01-2027.",
    );
    expect(scheduleSentence(expense({ repeat: "once", start: "2026-11-05" }))).toBe("Comes off once, on 05-11-2026.");
  });

  it("knows when an expense is over", () => {
    expect(hasEnded(expense(), "2030-01-01")).toBe(false);
    expect(hasEnded(expense({ end: "2027-01-31" }), "2027-02-01")).toBe(true);
    expect(hasEnded(expense({ repeat: "once", start: "2026-11-05" }), "2026-11-05")).toBe(false);
    expect(hasEnded(expense({ repeat: "once", start: "2026-11-05" }), "2026-11-06")).toBe(true);
  });
});

describe("parseShareExpense", () => {
  const form = (over: Record<string, string> = {}) => ({
    name: "  Shop   rent ",
    ashi: "1,500",
    dad: "₹1500.50",
    repeat: "monthly",
    start: "2026-11-01",
    end: "",
    ...over,
  });

  it("reads a monthly expense, with no end date", () => {
    expect(parseShareExpense(form())).toEqual({
      value: { name: "Shop rent", ashi: 1500, dad: 1500.5, repeat: "monthly", start: "2026-11-01", end: null },
    });
  });

  it("treats an empty amount as nothing taken from that partner", () => {
    expect(parseShareExpense(form({ dad: "" })).value).toMatchObject({ ashi: 1500, dad: 0 });
  });

  it("drops the end date of a one-time expense", () => {
    expect(parseShareExpense(form({ repeat: "once", end: "2027-01-31" })).value?.end).toBeNull();
  });

  it("rejects what cannot be right", () => {
    expect(parseShareExpense(form({ name: " " })).error).toBe("Write what the expense is for");
    expect(parseShareExpense(form({ ashi: "", dad: "0" })).error).toBe("Enter an amount for Ashi, Dad or both");
    expect(parseShareExpense(form({ ashi: "-5" })).error).toBe("The amount for Ashi cannot be less than 0");
    expect(parseShareExpense(form({ dad: "abc" })).error).toBe("Enter the amount for Dad");
    expect(parseShareExpense(form({ ashi: "1.005" })).error).toBe("The amount for Ashi can have at most 2 decimals");
    expect(parseShareExpense(form({ start: "2026-02-30" })).error).toBe("Enter a valid start date");
    expect(parseShareExpense(form({ end: "2026-10-31" })).error).toBe("The end date must be on or after the start date");
    expect(parseShareExpense(form({ repeat: "weekly" })).error).toBe("Choose how often it comes off");
  });
});

describe("readShareExpenses", () => {
  it("keeps good entries, newest start first, and skips broken ones", () => {
    const saved = [expense({ id: "old", start: "2026-01-01" }), { id: "bad", name: "x" }, expense({ id: "new", start: "2026-11-01" })];
    expect(readShareExpenses(saved).map((e) => e.id)).toEqual(["new", "old"]);
    expect(readShareExpenses(null)).toEqual([]);
    expect(readShareExpenses({})).toEqual([]);
  });
});

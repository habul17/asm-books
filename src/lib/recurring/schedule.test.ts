import { describe, expect, it } from "vitest";

import { advance, isDue, nextOccurrence, parseRecurringInput, suggestedStart } from "./schedule";

describe("nextOccurrence", () => {
  it("steps by the chosen interval", () => {
    expect(nextOccurrence("2026-11-13", "weekly", 13)).toBe("2026-11-20");
    expect(nextOccurrence("2026-12-28", "weekly", 28)).toBe("2027-01-04");
    expect(nextOccurrence("2026-11-13", "monthly", 13)).toBe("2026-12-13");
    expect(nextOccurrence("2026-12-13", "monthly", 13)).toBe("2027-01-13");
    expect(nextOccurrence("2026-11-13", "quarterly", 13)).toBe("2027-02-13");
    expect(nextOccurrence("2026-11-13", "half_yearly", 13)).toBe("2027-05-13");
    expect(nextOccurrence("2026-11-13", "yearly", 13)).toBe("2027-11-13");
  });

  it("uses the last day of a short month and then returns to the chosen day", () => {
    expect(nextOccurrence("2027-01-31", "monthly", 31)).toBe("2027-02-28");
    expect(nextOccurrence("2027-02-28", "monthly", 31)).toBe("2027-03-31");
    expect(nextOccurrence("2027-03-31", "monthly", 31)).toBe("2027-04-30");
    expect(nextOccurrence("2028-01-31", "monthly", 31)).toBe("2028-02-29");
    expect(nextOccurrence("2028-02-29", "yearly", 29)).toBe("2029-02-28");
  });
});

describe("suggestedStart", () => {
  it("offers one step after the invoice", () => {
    expect(suggestedStart("2026-11-01", "monthly", "2026-11-13")).toBe("2026-12-01");
  });

  it("never offers a date in the past", () => {
    expect(suggestedStart("2026-01-15", "monthly", "2026-11-13")).toBe("2026-11-15");
    expect(suggestedStart("2026-01-10", "monthly", "2026-11-13")).toBe("2026-12-10");
    expect(suggestedStart("2025-11-13", "yearly", "2026-11-13")).toBe("2026-11-13");
  });
});

describe("isDue", () => {
  const r = { nextDate: "2026-11-13", endDate: null, active: true };
  it("is due on and after the next date", () => {
    expect(isDue(r, "2026-11-12")).toBe(false);
    expect(isDue(r, "2026-11-13")).toBe(true);
    expect(isDue(r, "2026-12-25")).toBe(true);
  });
  it("is never due when stopped or past its end", () => {
    expect(isDue({ ...r, active: false }, "2026-11-13")).toBe(false);
    expect(isDue({ ...r, endDate: "2026-11-12" }, "2026-11-13")).toBe(false);
    expect(isDue({ ...r, endDate: "2026-11-13" }, "2026-11-13")).toBe(true);
  });
});

describe("advance", () => {
  it("moves to the next date", () => {
    expect(advance({ nextDate: "2026-11-13", endDate: null, frequency: "monthly", anchorDay: 13 })).toEqual({
      nextDate: "2026-12-13",
      active: true,
    });
  });
  it("stops once the next date is past the end date", () => {
    const r = { nextDate: "2026-11-13", frequency: "monthly" as const, anchorDay: 13 };
    expect(advance({ ...r, endDate: "2026-12-13" }).active).toBe(true);
    expect(advance({ ...r, endDate: "2026-12-12" }).active).toBe(false);
  });
});

describe("parseRecurringInput", () => {
  const ok = { invoiceId: "12", frequency: "monthly", nextDate: "2026-12-01", endDate: "", notes: " AMC " };
  it("accepts a normal form", () => {
    expect(parseRecurringInput(ok)).toEqual({
      value: { invoiceId: 12, frequency: "monthly", nextDate: "2026-12-01", endDate: null, notes: "AMC" },
    });
    expect(parseRecurringInput({ ...ok, endDate: "2027-03-31" }).value?.endDate).toBe("2027-03-31");
  });
  it.each([
    [{ invoiceId: "x" }, "Invoice not found"],
    [{ frequency: "daily" }, "Choose how often to repeat"],
    [{ nextDate: "2026-02-30" }, "Enter the date of the next invoice"],
    [{ endDate: "soon" }, "Enter a valid end date"],
    [{ endDate: "2026-11-30" }, "The end date cannot be before the next invoice date"],
  ])("rejects %j", (change, error) => {
    expect(parseRecurringInput({ ...ok, ...change })).toEqual({ error });
  });
});

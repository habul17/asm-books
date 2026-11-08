import { describe, expect, it } from "vitest";

import { isIsoDate, parsePeriod, periodQuery, presetRange } from "./period";

describe("isIsoDate", () => {
  it("accepts real dates only", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("presetRange", () => {
  it("covers this and last month", () => {
    expect(presetRange("this-month", "2026-11-08")).toEqual({ from: "2026-11-01", to: "2026-11-08" });
    expect(presetRange("last-month", "2026-11-08")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(presetRange("last-month", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(presetRange("last-month", "2028-03-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("follows the April to March financial year", () => {
    expect(presetRange("this-fy", "2026-11-08")).toEqual({ from: "2026-04-01", to: "2026-11-08" });
    expect(presetRange("this-fy", "2027-02-01")).toEqual({ from: "2026-04-01", to: "2027-02-01" });
    expect(presetRange("last-fy", "2026-04-01")).toEqual({ from: "2025-04-01", to: "2026-03-31" });
    expect(presetRange("last-fy", "2026-03-31")).toEqual({ from: "2024-04-01", to: "2025-03-31" });
  });
});

describe("parsePeriod", () => {
  const today = "2026-11-08";

  it("defaults to this month", () => {
    expect(parsePeriod({}, today)).toMatchObject({ from: "2026-11-01", to: today, preset: "this-month" });
    expect(parsePeriod({ period: "nonsense" }, today).preset).toBe("this-month");
  });

  it("uses a valid custom range and swaps it if reversed", () => {
    expect(parsePeriod({ from: "2026-10-31", to: "2026-10-01" }, today)).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
      preset: "custom",
      label: "01-10-2026 to 31-10-2026",
    });
  });

  it("ignores a broken custom range", () => {
    expect(parsePeriod({ from: "2026-10-01", to: "x", period: "today" }, today)).toMatchObject({
      from: today,
      to: today,
      preset: "today",
    });
  });

  it("round-trips through the query string", () => {
    expect(periodQuery(parsePeriod({}, today))).toBe("");
    expect(periodQuery(parsePeriod({ period: "last-fy" }, today))).toBe("period=last-fy");
    expect(periodQuery(parsePeriod({ from: "2026-10-01", to: "2026-10-05" }, today))).toBe("from=2026-10-01&to=2026-10-05");
  });
});

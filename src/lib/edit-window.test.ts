import { describe, expect, it } from "vitest";

import { canChangeToday, sameShopDay } from "./edit-window";

describe("canChangeToday", () => {
  const made = new Date("2026-11-14T04:00:00Z"); // 9:30 am in India

  it("lets staff change a bill on the day it was made", () => {
    expect(canChangeToday(false, made, new Date("2026-11-14T18:00:00Z"))).toBe(true); // 11:30 pm
  });

  it("stops staff after midnight in India, not UTC", () => {
    expect(canChangeToday(false, made, new Date("2026-11-14T18:31:00Z"))).toBe(false); // 12:01 am on the 15th
  });

  it("always lets the owner change", () => {
    expect(canChangeToday(true, made, new Date("2027-01-01T00:00:00Z"))).toBe(true);
  });

  it("compares days in India", () => {
    expect(sameShopDay(new Date("2026-11-13T19:00:00Z"), new Date("2026-11-14T10:00:00Z"))).toBe(true); // both the 14th
  });
});

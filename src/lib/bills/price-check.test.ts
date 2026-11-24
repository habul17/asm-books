import { describe, expect, it } from "vitest";

import { comparePrice, formatPct, netRate, summarizePrices } from "./price-check";

const last = { net: 120, date: "2026-11-12", billNo: "456", vendor: "Sri Auto Agencies" };

describe("comparePrice", () => {
  it("is the same price within half a paisa", () => {
    expect(comparePrice(120, last)).toEqual({ kind: "same", last });
    expect(comparePrice(120.004, last)).toEqual({ kind: "same", last });
  });

  it("shows how much more, with the share", () => {
    expect(comparePrice(125, last)).toEqual({ kind: "up", last, diff: 5, pct: 4.2 });
  });

  it("shows how much less", () => {
    expect(comparePrice(108, last)).toEqual({ kind: "down", last, diff: 12, pct: 10 });
  });

  it("rounds the difference to paise", () => {
    expect(comparePrice(120.0149, last)).toMatchObject({ kind: "up", diff: 0.01 });
  });

  it("says first time when the part was never on a saved bill", () => {
    expect(comparePrice(50, null)).toEqual({ kind: "first" });
  });

  it("says nothing until the rate and the last bill are known", () => {
    expect(comparePrice(null, last)).toBeNull();
    expect(comparePrice(Number.NaN, last)).toBeNull();
    expect(comparePrice(120, undefined)).toBeNull();
  });

  it("has no share when the last price was free", () => {
    expect(comparePrice(10, { ...last, net: 0 })).toEqual({ kind: "up", last: { ...last, net: 0 }, diff: 10, pct: null });
  });
});

describe("netRate", () => {
  it("takes the discount off", () => {
    expect(netRate(200, 10)).toBe(180);
    expect(netRate(99.99, 0)).toBe(99.99);
  });
});

describe("summarizePrices", () => {
  it("counts each kind and skips rows without a comparison", () => {
    const rows = [comparePrice(125, last), comparePrice(120, last), comparePrice(100, last), comparePrice(5, null), null];
    expect(summarizePrices(rows)).toEqual({ up: 1, down: 1, same: 1, first: 1 });
  });
});

describe("formatPct", () => {
  it("keeps one decimal place", () => {
    expect(formatPct(4.2)).toBe("4.2%");
    expect(formatPct(10)).toBe("10%");
    expect(formatPct(null)).toBe("");
  });
});

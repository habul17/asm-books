import { describe, expect, it } from "vitest";

import { moneyPrefill } from "./prefill";

describe("moneyPrefill", () => {
  it("takes checked values from a link", () => {
    expect(moneyPrefill({ amount: "2632", date: "2026-11-07", mode: "upi", ref: "531122334455", notes: "UPI/CR/…", category: "Bank charges" }, "2026-11-16")).toEqual({
      amount: 2632,
      date: "2026-11-07",
      mode: "upi",
      reference: "531122334455",
      notes: "UPI/CR/…",
      category: "Bank charges",
    });
  });

  it("drops odd values", () => {
    const p = moneyPrefill({ amount: "-5", date: "2026-12-01", mode: "gold" }, "2026-11-16");
    expect(p).toMatchObject({ amount: null, date: null, mode: null, reference: "", notes: "" });
  });
});

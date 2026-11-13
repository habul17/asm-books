import { describe, expect, it } from "vitest";

import { isTransfer, kindTotals, MONEY_KIND_INFO, MONEY_KINDS, parseMoneyEntry } from "./entries";

const ok = { kind: "owner_in", party: "", date: "2026-11-13", amount: "50,000", mode: "bank", reference: " NEFT 123 ", notes: "" };

describe("parseMoneyEntry", () => {
  it("accepts a normal entry and cleans it", () => {
    expect(parseMoneyEntry(ok)).toEqual({
      value: { kind: "owner_in", party: "", date: "2026-11-13", amount: 50000, mode: "bank", reference: "NEFT 123", notes: "" },
    });
  });

  it("reads FormData too", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(ok)) fd.set(k, v);
    expect(parseMoneyEntry(fd).value?.amount).toBe(50000);
  });

  it("needs a mode, except when cash moves to or from the bank", () => {
    expect(parseMoneyEntry({ ...ok, mode: "" })).toEqual({ error: "Choose how it was paid" });
    expect(parseMoneyEntry({ ...ok, kind: "deposit", mode: "" }).value).toMatchObject({ kind: "deposit", mode: null });
    // A mode or a name sent with a transfer is dropped.
    expect(parseMoneyEntry({ ...ok, kind: "withdraw", mode: "upi", party: "SBI" }).value).toMatchObject({ mode: null, party: "" });
  });

  it.each([
    [{ kind: "gift" }, "Choose what the money was for"],
    [{ amount: "0" }, "Amount must be more than 0"],
    [{ amount: "" }, "Enter the amount moved"],
    [{ date: "13/11/2026" }, "Enter a valid date"],
    [{ party: "x".repeat(101) }, "Name can be at most 100 characters"],
  ])("rejects %j", (change, error) => {
    expect(parseMoneyEntry({ ...ok, ...change })).toEqual({ error });
  });
});

describe("kinds", () => {
  it("describes every kind", () => {
    for (const k of MONEY_KINDS) expect(MONEY_KIND_INFO[k].label).toBeTruthy();
    expect(MONEY_KINDS.filter(isTransfer)).toEqual(["deposit", "withdraw"]);
  });

  it("fills in kinds that have no entries", () => {
    const t = kindTotals([{ kind: "loan_in", amount: 1000, cash: 200 }]);
    expect(t.loan_in).toEqual({ amount: 1000, cash: 200 });
    expect(t.gst_paid).toEqual({ amount: 0, cash: 0 });
    expect(Object.keys(t)).toHaveLength(MONEY_KINDS.length);
  });
});

import { describe, expect, it } from "vitest";

import { parsePaymentInput } from "./validation";

const ok = { customerId: "7", date: "2026-11-07", amount: "1,500.50", mode: "upi", reference: " UTR123 ", notes: "" };

describe("parsePaymentInput", () => {
  it("accepts a normal payment and cleans the values", () => {
    expect(parsePaymentInput(ok)).toEqual({
      value: { customerId: 7, date: "2026-11-07", amount: 1500.5, mode: "upi", reference: "UTR123", notes: "" },
    });
  });

  it("reads FormData too", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(ok)) fd.set(k, v);
    expect(parsePaymentInput(fd).value?.amount).toBe(1500.5);
  });

  it.each([
    [{ customerId: "" }, "Choose a customer"],
    [{ customerId: "abc" }, "Choose a customer"],
    [{ date: "07-11-2026" }, "Enter a valid date"],
    [{ amount: "" }, "Enter the amount received"],
    [{ amount: "0" }, "Amount must be more than 0"],
    [{ amount: "-5" }, "Amount must be more than 0"],
    [{ amount: "10.555" }, "Amount can have at most 2 decimals"],
    [{ amount: "999999999" }, "Amount is too large; please check it"],
    [{ mode: "bitcoin" }, "Choose how it was paid"],
    [{ reference: "x".repeat(101) }, "Reference can be at most 100 characters"],
  ])("rejects %j", (change, error) => {
    expect(parsePaymentInput({ ...ok, ...change })).toEqual({ error });
  });
});

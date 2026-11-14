import { describe, expect, it } from "vitest";

import { UPI_ID_PATTERN, upiPayLink } from "./upi";

describe("upiPayLink", () => {
  it("fills in who to pay, the amount and the bill number", () => {
    expect(upiPayLink({ upiId: "asm.parts@okaxis", name: "ASM AUTOPARTS", amount: 1250.5, note: "Bill INV-12" })).toBe(
      "upi://pay?pa=asm.parts@okaxis&pn=ASM%20AUTOPARTS&am=1250.50&cu=INR&tn=Bill%20INV-12",
    );
  });

  it("keeps symbols in the name from breaking the link", () => {
    expect(upiPayLink({ upiId: "a@b", name: "A & B", amount: 1, note: "x" })).toContain("pn=A%20%26%20B&");
  });

  it("knows a UPI ID", () => {
    expect(UPI_ID_PATTERN.test("shop.name-1@okicici")).toBe(true);
    expect(UPI_ID_PATTERN.test("9876543210@ybl")).toBe(true);
    expect(UPI_ID_PATTERN.test("no-at-sign")).toBe(false);
  });
});

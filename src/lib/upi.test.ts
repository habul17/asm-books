import { describe, expect, it } from "vitest";

import { UPI_ID_PATTERN, upiPayLink } from "./upi";

describe("upiPayLink", () => {
  it("fills in who to pay and the bill number, and leaves the amount to the customer", () => {
    const link = upiPayLink({ upiId: "asm.parts@okaxis", name: "ASM AUTOPARTS", note: "Bill INV-12" });
    expect(link).toBe("upi://pay?pa=asm.parts@okaxis&pn=ASM%20AUTOPARTS&cu=INR&tn=Bill%20INV-12");
    expect(link).not.toContain("am=");
  });

  it("keeps symbols in the name from breaking the link", () => {
    expect(upiPayLink({ upiId: "a@b", name: "A & B", note: "x" })).toContain("pn=A%20%26%20B&");
  });

  it("knows a UPI ID", () => {
    expect(UPI_ID_PATTERN.test("shop.name-1@okicici")).toBe(true);
    expect(UPI_ID_PATTERN.test("9876543210@ybl")).toBe(true);
    expect(UPI_ID_PATTERN.test("no-at-sign")).toBe(false);
  });
});

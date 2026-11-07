import { describe, expect, it } from "vitest";

import { withCheckChar } from "@/lib/gst";

import { parseVendor } from "./validation";

const form = (overrides: Record<string, unknown> = {}) => ({
  name: "Bosch Distributor",
  contactPerson: "",
  mobile: "98400 12345",
  email: "",
  address: "",
  city: "Bengaluru",
  stateCode: "",
  pincode: "",
  gstin: "",
  openingBalance: "",
  balanceSide: "we-owe",
  paymentTermsDays: "",
  notes: "",
  active: "on",
  ...overrides,
});

describe("parseVendor", () => {
  it("needs a name", () => {
    expect(parseVendor(form({ name: " " })).error).toBe("Vendor name is required");
  });

  it("treats the opening balance as money we owe by default", () => {
    expect(parseVendor(form({ openingBalance: "1,500" })).value?.openingBalance).toBe(1500);
    expect(parseVendor(form({ openingBalance: "200", balanceSide: "owes-us" })).value?.openingBalance).toBe(-200);
  });

  it("takes the state from a valid GSTIN", () => {
    const { value } = parseVendor(form({ gstin: withCheckChar("29ABCDE1234F1Z").toLowerCase(), stateCode: "33" }));
    expect(value?.stateCode).toBe("29");
    expect(value?.gstin).toBe(withCheckChar("29ABCDE1234F1Z"));
  });

  it("rejects a bad mobile", () => {
    expect(parseVendor(form({ mobile: "12" })).error).toMatch(/6 to 15 digits/);
  });
});

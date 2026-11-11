import { describe, expect, it } from "vitest";

import type { CustomFieldDef } from "@/lib/custom-fields";
import { checkGstin, withCheckChar } from "@/lib/gst";

import { groupSchema, parseCustomer } from "./validation";

const GSTIN = withCheckChar("33ABCDE1234F1Z");

const form = (overrides: Record<string, unknown> = {}) => ({
  name: "Sri Murugan Garage",
  contactPerson: "",
  mobile: "98400 12345",
  email: "",
  address: "",
  city: "Chennai",
  stateCode: "",
  pincode: "",
  gstin: "",
  groupId: "",
  priceListId: "",
  openingBalance: "",
  balanceSide: "owes-us",
  creditLimit: "",
  paymentTermsDays: "",
  notes: "",
  active: "on",
  ...overrides,
});

describe("checkGstin", () => {
  it("accepts a valid GSTIN and reads the state", () => {
    expect(checkGstin(GSTIN.toLowerCase())).toEqual({ ok: true, gstin: GSTIN, stateCode: "33" });
  });

  it("explains what is wrong", () => {
    expect(checkGstin("33ABC")).toMatchObject({ ok: false, error: expect.stringContaining("15 characters") });
    const wrongLast = GSTIN.slice(0, 14) + (GSTIN[14] === "A" ? "B" : "A");
    expect(checkGstin(wrongLast)).toMatchObject({ ok: false, error: expect.stringContaining("typing mistake") });
    expect(checkGstin(withCheckChar("99ABCDE1234F1Z"))).toMatchObject({ ok: false });
  });
});

describe("parseCustomer", () => {
  it("cleans up the form values", () => {
    const { value } = parseCustomer(form(), []);
    expect(value).toMatchObject({
      name: "Sri Murugan Garage",
      mobile: "9840012345",
      contactPerson: null,
      city: "Chennai",
      openingBalance: 0,
      creditLimit: null,
      paymentTermsDays: null,
      active: true,
      extra: {},
    });
  });

  it("takes the state from the GSTIN", () => {
    const { value } = parseCustomer(form({ gstin: GSTIN, stateCode: "27" }), []);
    expect(value).toMatchObject({ gstin: GSTIN, stateCode: "33" });
  });

  it("stores money we owe the customer as a negative opening balance", () => {
    expect(parseCustomer(form({ openingBalance: "1,500", balanceSide: "we-owe" }), []).value?.openingBalance).toBe(
      -1500,
    );
    expect(parseCustomer(form({ openingBalance: "₹ 250.555" }), []).value?.openingBalance).toBe(250.56);
  });

  it("rejects bad values with a clear message", () => {
    expect(parseCustomer(form({ name: " " }), []).error).toBe("Customer name is required");
    expect(parseCustomer(form({ mobile: "12ab" }), []).error).toContain("Mobile");
    expect(parseCustomer(form({ email: "a@b" }), []).error).toBe("Email does not look right");
    expect(parseCustomer(form({ pincode: "6000" }), []).error).toBe("PIN code should be 6 digits");
    expect(parseCustomer(form({ creditLimit: "-5" }), []).error).toBe("Credit limit cannot be negative");
    expect(parseCustomer(form({ paymentTermsDays: "1.5" }), []).error).toBe("Payment terms must be whole days");
    expect(parseCustomer(form({ gstin: "33ABC" }), []).error).toContain("GSTIN");
  });

  it("reads custom fields and keeps values of switched-off fields", () => {
    const fields: CustomFieldDef[] = [
      { id: 1, label: "Vehicle", type: "text", active: true },
      { id: 2, label: "Fleet size", type: "number", active: true },
      { id: 3, label: "Since", type: "date", active: true },
      { id: 4, label: "Old field", type: "text", active: false },
    ];
    const { value } = parseCustomer(
      form({ "extra.1": " Tata Ace ", "extra.2": "12", "extra.3": "2024-01-15", "extra.4": "ignored" }),
      fields,
      { "4": "kept", "9": "unknown field is dropped" },
    );
    expect(value?.extra).toEqual({ "1": "Tata Ace", "2": 12, "3": "2024-01-15", "4": "kept" });

    expect(parseCustomer(form({ "extra.2": "many" }), fields).error).toBe("Fleet size must be a number");
  });
});

describe("groupSchema", () => {
  it("requires a name", () => {
    expect(groupSchema.safeParse({ name: "", priceListId: "" }).success).toBe(false);
    expect(groupSchema.parse({ name: " Garages ", priceListId: "3" })).toEqual({ name: "Garages", priceListId: 3 });
  });
});

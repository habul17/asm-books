import { describe, expect, it } from "vitest";

import { withCheckChar } from "@/lib/gst";

import { DEFAULT_BUSINESS, parseBusiness, readBusiness } from "./business";

const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ name: "SuperMN Auto", invoicePrefix: "inv", defaultGstRate: "18", ...values })) {
    f.set(k, v);
  }
  return f;
};

describe("readBusiness", () => {
  it("fills defaults and ignores bad stored values", () => {
    expect(readBusiness(null)).toEqual(DEFAULT_BUSINESS);
    const r = readBusiness({ name: "Shop", defaultGstRate: 7, invoicePrefix: 5, hacker: "x" });
    expect(r.name).toBe("Shop");
    expect(r.defaultGstRate).toBe(18);
    expect(r.invoicePrefix).toBe("INV");
    expect("hacker" in r).toBe(false);
    expect(readBusiness({ defaultPriceListId: 3 }).defaultPriceListId).toBe(3);
    expect(readBusiness({ defaultPriceListId: "3" }).defaultPriceListId).toBeNull();
  });
});

describe("parseBusiness", () => {
  it("accepts a minimal form and normalises values", () => {
    const r = parseBusiness(form({ bankIfsc: "sbin0001234", email: " A@B.COM ", pincode: "600 001" }));
    expect(r.error).toBeUndefined();
    expect(r.value).toMatchObject({
      invoicePrefix: "INV",
      bankIfsc: "SBIN0001234",
      email: "a@b.com",
      pincode: "600001",
      defaultPriceListId: null,
    });
    expect(parseBusiness(form({ defaultPriceListId: "4" })).value?.defaultPriceListId).toBe(4);
  });

  it("reads the sales rule checkboxes (unticked boxes are not sent)", () => {
    expect(parseBusiness(form({})).value).toMatchObject({ allowWalkIn: false, allowShortStock: false });
    expect(parseBusiness(form({ allowWalkIn: "on", allowShortStock: "on" })).value).toMatchObject({
      allowWalkIn: true,
      allowShortStock: true,
    });
    expect(readBusiness({ allowWalkIn: "yes" }).allowWalkIn).toBe(false);
  });

  it("takes the state from a valid GSTIN", () => {
    const gstin = withCheckChar("33ABCDE1234F1Z");
    const r = parseBusiness(form({ gstin: gstin.toLowerCase(), stateCode: "29" }));
    expect(r.value).toMatchObject({ gstin, stateCode: "33" });
  });

  it("rejects bad values with a clear message", () => {
    expect(parseBusiness(form({ name: " " })).error).toMatch(/name is required/);
    expect(parseBusiness(form({ invoicePrefix: "IN/V" })).error).toMatch(/prefix/);
    expect(parseBusiness(form({ defaultGstRate: "7" })).error).toMatch(/Default GST/);
    expect(parseBusiness(form({ bankIfsc: "SBI123" })).error).toMatch(/IFSC/);
    expect(parseBusiness(form({ stateCode: "99" })).error).toMatch(/state/);
    expect(parseBusiness(form({ gstin: "33ABCDE1234F1ZZ" })).error).toBeTruthy();
    expect(parseBusiness(form({ defaultPriceListId: "x" })).error).toMatch(/price list/);
  });
});

describe("reminder settings", () => {
  it("defaults to 15 days and no shop-wide low stock level", () => {
    const r = parseBusiness(form({}));
    expect(r.value?.paymentReminderDays).toBe(15);
    expect(r.value?.defaultMinStock).toBe(0);
    expect(readBusiness({ paymentReminderDays: 0, defaultMinStock: -2 })).toMatchObject({
      paymentReminderDays: 15,
      defaultMinStock: 0,
    });
  });

  it("accepts sensible values and refuses the rest", () => {
    expect(parseBusiness(form({ paymentReminderDays: "30", defaultMinStock: "2.5" })).value).toMatchObject({
      paymentReminderDays: 30,
      defaultMinStock: 2.5,
    });
    expect(parseBusiness(form({ paymentReminderDays: "0" })).error).toMatch(/1 to 365/);
    expect(parseBusiness(form({ paymentReminderDays: "7.5" })).error).toMatch(/whole number/);
    expect(parseBusiness(form({ paymentReminderDays: "abc" })).error).toBeTruthy();
    expect(parseBusiness(form({ defaultMinStock: "-1" })).error).toMatch(/0 or more/);
  });
});

describe("opening cash", () => {
  it("defaults to 0, keeps paise and allows an overdraft", () => {
    expect(parseBusiness(form({})).value?.openingCash).toBe(0);
    expect(parseBusiness(form({ openingCash: "25000.505" })).value?.openingCash).toBe(25000.51);
    expect(parseBusiness(form({ openingCash: "-1200" })).value?.openingCash).toBe(-1200);
    expect(parseBusiness(form({ openingCash: "abc" })).error).toBeTruthy();
    expect(readBusiness({ openingCash: "5" }).openingCash).toBe(0);
  });
});

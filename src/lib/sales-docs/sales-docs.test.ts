import { describe, expect, it } from "vitest";

import { closesSource, kindFromSlug, NEXT_STEPS, SALES_DOC_KIND, SALES_DOC_KINDS, salesDocHref } from "./kinds";
import { parseSalesDocInput } from "./validation";

const line = { productId: 1, description: "ZZ TEST part", qty: 2, rate: 100, discountPct: 0, gstRate: 18 };
const base = {
  date: "2010-05-01",
  customerId: 1,
  walkInName: "",
  walkInMobile: "",
  priceListId: null,
  notes: "",
  lines: [line],
};

describe("sales document kinds", () => {
  it("gives every kind its own URL", () => {
    const slugs = SALES_DOC_KINDS.map((k) => SALES_DOC_KIND[k].slug);
    expect(new Set(slugs).size).toBe(SALES_DOC_KINDS.length);
    for (const k of SALES_DOC_KINDS) expect(kindFromSlug(SALES_DOC_KIND[k].slug)).toBe(k);
    expect(kindFromSlug("invoices")).toBeNull();
    expect(salesDocHref("quote", 7)).toBe("/sales/quotes/7");
  });

  it("knows what each kind can become", () => {
    expect(NEXT_STEPS.quote).toEqual(["order", "invoice"]);
    expect(NEXT_STEPS.order).toEqual(["challan", "invoice"]);
    expect(NEXT_STEPS.challan).toEqual(["invoice"]);
  });

  it("closes a quote when it becomes an order, but keeps an order open for its challans", () => {
    expect(closesSource("quote", "order")).toBe(true);
    expect(closesSource("order", "challan")).toBe(false);
    expect(closesSource("order", "invoice")).toBe(true);
    expect(closesSource("challan", "invoice")).toBe(true);
  });
});

describe("parseSalesDocInput", () => {
  it("accepts a document and fills in what was left out", () => {
    const { value } = parseSalesDocInput(base);
    expect(value).toMatchObject({ secondDate: null, reason: "", sourceId: null, placeOfSupply: null });
    expect(value?.lines).toHaveLength(1);
  });

  it("drops what only invoices have", () => {
    const { value } = parseSalesDocInput({ ...base, paymentType: "cash", extra: { "1": "x" }, fromDocId: 4 });
    expect(value).not.toHaveProperty("paymentType");
    expect(value).not.toHaveProperty("extra");
    expect(value).not.toHaveProperty("fromDocId");
  });

  it("checks the second date and the lines", () => {
    expect(parseSalesDocInput({ ...base, secondDate: "2010-05-10" }).value?.secondDate).toBe("2010-05-10");
    expect(parseSalesDocInput({ ...base, secondDate: "2010-04-30" }).error).toMatch(/cannot be before/);
    expect(parseSalesDocInput({ ...base, secondDate: "soon" }).error).toMatch(/not valid/);
    expect(parseSalesDocInput({ ...base, lines: [{ ...line, qty: 0 }] }).error).toMatch(/^Item 1:/);
    expect(parseSalesDocInput({ ...base, lines: [] }).error).toMatch(/at least one/);
  });
});

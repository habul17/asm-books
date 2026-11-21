import { describe, expect, it } from "vitest";

import { builtInTemplates, fillTemplate, MAX_BODY, parseNewTemplate, readTemplates } from "./templates";

describe("builtInTemplates", () => {
  it("offers the balance message only when the customer owes something", () => {
    expect(builtInTemplates("customer", true).map((t) => t.id)).toContain("balance");
    expect(builtInTemplates("customer", false).map((t) => t.id)).not.toContain("balance");
    expect(builtInTemplates("customer", false).map((t) => t.id)).toContain("order-today");
  });

  it("gives vendors buying messages, not payment reminders", () => {
    const ids = builtInTemplates("vendor", true).map((t) => t.id);
    expect(ids).not.toContain("balance");
    expect(ids).toContain("availability");
  });
});

describe("fillTemplate", () => {
  it("fills the name, shop and balance", () => {
    expect(fillTemplate("Dear {name}, {balance} due with {shop}.", { name: "Ravi", balance: "₹500.00", shop: "ASM" })).toBe(
      "Dear Ravi, ₹500.00 due with ASM.",
    );
  });

  it("says how long the balance has waited, when known", () => {
    const body = builtInTemplates("customer", true).find((t) => t.id === "balance")!.body;
    const fill = { name: "Ravi", balance: "₹500.00", shop: "ASM" };
    expect(fillTemplate(body, { ...fill, pending: { days: 22, since: "30-10-2026" } })).toContain(
      "A balance of ₹500.00 has been pending on your account for 22 days, since 30-10-2026.",
    );
    expect(fillTemplate(body, { ...fill, pending: { days: 1, since: "20-11-2026" } })).toContain("for 1 day, since");
    expect(fillTemplate(body, { ...fill, pending: { days: 0, since: "21-11-2026" } })).toContain("on your account. Kindly");
    expect(fillTemplate(body, fill)).toContain("on your account. Kindly");
  });

  it("never leaves a raw {word} behind", () => {
    const out = fillTemplate("{Name} {shop} {balance} {pending}", { name: " ", balance: null, shop: "" });
    expect(out).not.toMatch(/[{}]/);
  });
});

describe("readTemplates", () => {
  it("keeps good templates and drops broken ones", () => {
    expect(
      readTemplates([{ id: "a", title: "Hi", body: "Hello" }, { id: "b", title: "", body: "x" }, "junk", null]),
    ).toEqual([{ id: "a", title: "Hi", body: "Hello" }]);
    expect(readTemplates(undefined)).toEqual([]);
  });
});

describe("parseNewTemplate", () => {
  it("needs a name and a message", () => {
    expect(parseNewTemplate("", "x")).toHaveProperty("error");
    expect(parseNewTemplate("x", "  ")).toHaveProperty("error");
    expect(parseNewTemplate("x", "y".repeat(MAX_BODY + 1))).toHaveProperty("error");
    expect(parseNewTemplate(" Diwali ", " Happy Diwali ")).toEqual({ value: { title: "Diwali", body: "Happy Diwali" } });
  });
});

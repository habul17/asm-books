import { describe, expect, it } from "vitest";

import { createsFolderCycle, folderSchema, manualPriceSchema, priceListSchema } from "./validation";

const form = (overrides: Record<string, unknown> = {}) => ({
  name: "Retail",
  folderId: "",
  base: "purchase",
  adjustType: "markup",
  adjustPct: "20",
  discountPct: "",
  roundTo: "0",
  enabled: "on",
  notes: "",
  ...overrides,
});

describe("priceListSchema", () => {
  it("reads form values into typed fields", () => {
    expect(priceListSchema.parse(form())).toEqual({
      name: "Retail",
      folderId: null,
      base: "purchase",
      adjustType: "markup",
      adjustPct: 20,
      discountPct: 0,
      roundTo: 0,
      enabled: true,
      notes: null,
    });
  });

  it("treats a missing checkbox as switched off", () => {
    const values: Record<string, unknown> = form();
    delete values.enabled;
    expect(priceListSchema.parse(values).enabled).toBe(false);
  });

  it("rejects a blank name, unknown base and out-of-range numbers", () => {
    expect(priceListSchema.safeParse(form({ name: "  " })).success).toBe(false);
    expect(priceListSchema.safeParse(form({ base: "cost" })).success).toBe(false);
    expect(priceListSchema.safeParse(form({ adjustPct: "-5" })).success).toBe(false);
    expect(priceListSchema.safeParse(form({ adjustPct: "abc" })).success).toBe(false);
    expect(priceListSchema.safeParse(form({ discountPct: "101" })).success).toBe(false);
  });

  it("does not allow a markdown above 100%", () => {
    const result = priceListSchema.safeParse(form({ adjustType: "markdown", adjustPct: "150" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Markdown cannot be more than 100%");
  });
});

describe("folderSchema", () => {
  it("trims the name and reads the parent folder", () => {
    expect(folderSchema.parse({ name: " Dealers ", parentId: "3" })).toEqual({ name: "Dealers", parentId: 3 });
    expect(folderSchema.parse({ name: "Top", parentId: "" })).toEqual({ name: "Top", parentId: null });
  });
});

describe("manualPriceSchema", () => {
  it("accepts prices with ₹ and commas, and empty to clear", () => {
    expect(manualPriceSchema.parse("₹1,250.50")).toBe(1250.5);
    expect(manualPriceSchema.parse("")).toBeNull();
  });

  it("rejects negative and non-numeric prices", () => {
    expect(manualPriceSchema.safeParse("-1").error?.issues[0]?.message).toBe("Price cannot be negative");
    expect(manualPriceSchema.safeParse("ten").error?.issues[0]?.message).toBe("Enter a valid price");
  });
});

describe("createsFolderCycle", () => {
  // 1 → 2 → 3 (3 is inside 2, 2 is inside 1)
  const parents = new Map<number, number | null>([
    [1, null],
    [2, 1],
    [3, 2],
  ]);
  const parentOf = (id: number) => parents.get(id);

  it("blocks moving a folder into itself or its own subfolder", () => {
    expect(createsFolderCycle(1, 1, parentOf)).toBe(true);
    expect(createsFolderCycle(1, 3, parentOf)).toBe(true);
  });

  it("allows moving to the top level or a sibling branch", () => {
    expect(createsFolderCycle(3, null, parentOf)).toBe(false);
    expect(createsFolderCycle(2, 1, parentOf)).toBe(false);
  });
});

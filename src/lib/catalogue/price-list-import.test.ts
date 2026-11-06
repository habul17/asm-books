import { describe, expect, it } from "vitest";

import { cellNumber, cellText, parsePriceListRows, type RawRow } from "./price-list-import";

const row = (partNo: unknown, description: unknown, price?: unknown, hsn?: unknown): RawRow => ({
  partNo,
  description,
  price,
  hsn,
});

describe("cellText", () => {
  it("formats numbers without float noise", () => {
    expect(cellText(1001)).toBe("1001");
    expect(cellText(8.512309e7)).toBe("85123090");
  });

  it("reads formula results and rich text", () => {
    expect(cellText({ result: 42 })).toBe("42");
    expect(cellText({ richText: [{ text: "Head " }, { text: "Lamp" }] })).toBe("Head Lamp");
  });

  it("treats empty cells as empty text", () => {
    expect(cellText(null)).toBe("");
    expect(cellText(undefined)).toBe("");
  });
});

describe("cellNumber", () => {
  it("strips currency symbols and thousands separators", () => {
    expect(cellNumber("₹1,250.50")).toBe(1250.5);
  });

  it("keeps full precision of numeric cells without float noise", () => {
    expect(cellNumber(21.744219899999997)).toBe(21.7442199);
    expect(cellNumber({ result: 24.2198658 })).toBe(24.2198658);
  });

  it("returns null for blanks and text", () => {
    expect(cellNumber("")).toBeNull();
    expect(cellNumber("N/A")).toBeNull();
  });
});

describe("parsePriceListRows", () => {
  it("builds group → category → product structure", () => {
    const parsed = parsePriceListRows([
      row(null, "ELECTRICALS"),
      row(null, "BUZZERS"),
      row(1001, "Buzzer 12V", 20, 85123090),
      row(null, "FLASHERS"),
      row(1103, "Flasher 3 pin", 70),
    ]);

    expect(parsed.categories).toEqual([
      { name: "ELECTRICALS", parent: null, sort: 1 },
      { name: "BUZZERS", parent: "ELECTRICALS", sort: 2 },
      { name: "FLASHERS", parent: "ELECTRICALS", sort: 4 },
    ]);
    expect(parsed.products).toEqual([
      { partNo: "1001", description: "Buzzer 12V", hsn: "85123090", price: 20, group: "ELECTRICALS", category: "BUZZERS", sort: 3 },
      { partNo: "1103", description: "Flasher 3 pin", hsn: null, price: 70, group: "ELECTRICALS", category: "FLASHERS", sort: 5 },
    ]);
  });

  it("keeps the first copy of a duplicate part number and reports it", () => {
    const parsed = parsePriceListRows([row("8001LH", "Mirror", 100), row("8001LH", "Mirror copy", 120)]);
    expect(parsed.products).toHaveLength(1);
    expect(parsed.products[0].price).toBe(100);
    expect(parsed.duplicates).toEqual(["8001LH"]);
  });

  it("ignores blank rows and zero or missing prices", () => {
    const parsed = parsePriceListRows([row(null, null), row("A1", "Part", 0), row("A2", "Part", "")]);
    expect(parsed.products.map((p) => p.price)).toEqual([null, null]);
  });
});

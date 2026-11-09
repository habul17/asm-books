import { describe, expect, it } from "vitest";

import { parseMinStock } from "./min-stock";

describe("parseMinStock", () => {
  it("treats blank as no minimum", () => {
    expect(parseMinStock("")).toEqual({ value: null });
    expect(parseMinStock("   ")).toEqual({ value: null });
    expect(parseMinStock(undefined)).toEqual({ value: null });
  });

  it("accepts whole and decimal numbers", () => {
    expect(parseMinStock("5")).toEqual({ value: 5 });
    expect(parseMinStock(" 2.5 ")).toEqual({ value: 2.5 });
    expect(parseMinStock("0")).toEqual({ value: 0 });
  });

  it("rejects negatives, text and too many decimals", () => {
    for (const bad of ["-1", "abc", "1.2345", "1e3", "5 pcs"]) {
      expect(parseMinStock(bad).error).toBeDefined();
    }
  });

  it("rejects very large numbers", () => {
    expect(parseMinStock("1000001").error).toBeDefined();
  });
});

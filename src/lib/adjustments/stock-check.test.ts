import { describe, expect, it } from "vitest";

import { stockCheckLines, stockCheckSchema } from "./stock-check";

describe("stockCheckLines", () => {
  it("turns shelf counts into changes against the app and skips matches", () => {
    const now = new Map([
      [1, 80],
      [2, 10],
      [3, 0],
    ]);
    const out = stockCheckLines(
      [
        { productId: 1, counted: 78 },
        { productId: 2, counted: 10 },
        { productId: 3, counted: 5 },
      ],
      now,
    );
    expect(out).toEqual([
      [
        { productId: 1, qty: -2 },
        { productId: 3, qty: 5 },
      ],
    ]);
  });

  it("ignores parts that no longer exist", () => {
    expect(stockCheckLines([{ productId: 9, counted: 1 }], new Map())).toEqual([]);
  });

  it("splits a long check into adjustments of at most 300 lines", () => {
    const counts = Array.from({ length: 650 }, (_, i) => ({ productId: i + 1, counted: 1 }));
    const now = new Map(counts.map((c) => [c.productId, 0]));
    expect(stockCheckLines(counts, now).map((c) => c.length)).toEqual([300, 300, 50]);
  });

  it("rejects negative counts and a part counted twice", () => {
    expect(stockCheckSchema.safeParse({ counts: [{ productId: 1, counted: -1 }] }).success).toBe(false);
    expect(
      stockCheckSchema.safeParse({
        counts: [
          { productId: 1, counted: 1 },
          { productId: 1, counted: 2 },
        ],
      }).success,
    ).toBe(false);
  });
});

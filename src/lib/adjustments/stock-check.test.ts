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
      {
        reason: "Stock count correction",
        lines: [
          { productId: 1, qty: -2 },
          { productId: 3, qty: 5 },
        ],
      },
    ]);
  });

  it("ignores parts that no longer exist", () => {
    expect(stockCheckLines([{ productId: 9, counted: 1 }], new Map())).toEqual([]);
  });

  it("splits a long check into adjustments of at most 300 lines", () => {
    const counts = Array.from({ length: 650 }, (_, i) => ({ productId: i + 1, counted: 1 }));
    const now = new Map(counts.map((c) => [c.productId, 0]));
    expect(stockCheckLines(counts, now).map((c) => c.lines.length)).toEqual([300, 300, 50]);
  });

  it("saves stock of a part that never moved in the app as opening stock", () => {
    const now = new Map([
      [1, 0],
      [2, 4],
    ]);
    const out = stockCheckLines(
      [
        { productId: 1, counted: 6 },
        { productId: 2, counted: 5 },
      ],
      now,
      new Set([1]),
    );
    expect(out).toEqual([
      { reason: "Opening stock", lines: [{ productId: 1, qty: 6 }] },
      { reason: "Stock count correction", lines: [{ productId: 2, qty: 1 }] },
    ]);
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

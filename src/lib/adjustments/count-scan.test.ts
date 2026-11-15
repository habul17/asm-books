import { describe, expect, it } from "vitest";

import { countLineLabel, countQty, scannedCountSchema } from "./count-scan";

describe("count scan", () => {
  it("reads counts, including 0 and text numbers", () => {
    const s = scannedCountSchema.parse({ lines: [{ partNo: "1301", counted: "78" }, { partNo: "1402", counted: 0 }, { partNo: "X", counted: "?" }], doubts: [] });
    expect(s.lines.map((l) => l.counted)).toEqual([78, 0, null]);
  });

  it("accepts only sensible counts", () => {
    expect(countQty(0)).toBe(0);
    expect(countQty(2.5)).toBe(2.5);
    expect(countQty(-1)).toBeNull();
    expect(countQty(null)).toBeNull();
  });

  it("names a row the way it was written", () => {
    expect(countLineLabel({ partNo: "9999X", description: null, counted: 4 }, 6)).toBe("Row 6: 9999X = 4");
  });
});

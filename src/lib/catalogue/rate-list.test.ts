import { describe, expect, it } from "vitest";

import { reviewRateList, scannedRateListSchema } from "./rate-list";

const PARTS = [
  { id: 1, partNo: "1301", description: "Horn relay", unit: "Nos", gstRate: null, lastPrice: 89.36 },
  { id: 2, partNo: "1503T", description: "Reversing horn", unit: "Nos", gstRate: 18, lastPrice: 88.21 },
  { id: 3, partNo: "1638A", description: "Micro converter", unit: "Nos", gstRate: null, lastPrice: 384.7 },
];
const review = (lines: Record<string, unknown>[], extra: Record<string, unknown> = { pricesIncludeGst: false }) =>
  reviewRateList(scannedRateListSchema.parse({ doubts: [], lines, ...extra }), { parts: PARTS, defaultGstRate: 18, today: "2026-11-16" });

describe("reviewRateList", () => {
  it("sorts rows into changed, same, new and unclear", () => {
    const r = review([
      { partNo: "1301", rate: 95 },
      { partNo: "1503-T", rate: "88.21" },
      { partNo: "ZZ-NEW-1", description: "New lamp", hsn: "8512", gstRate: 18, rate: 250 },
      { description: "Bulb holder", rate: 12 },
      { partNo: "1638A", rate: null },
    ]);
    expect(r.rows.map((x) => x.status)).toEqual(["changed", "same", "new", "unclear", "unclear"]);
    expect(r.rows[0]).toMatchObject({ price: 95, changePct: 6.3, note: null, part: { id: 1, oldPrice: 89.36 } });
    expect(r.warnings).toEqual([]);
  });

  it("flags a big change for checking", () => {
    expect(review([{ partNo: "1638A", rate: 520 }]).rows[0].note).toMatch(/rise of 35.2%/);
  });

  it("takes GST out of a rate that includes it, after the discount", () => {
    const r = review([{ partNo: "1503T", rate: 200, discountPct: 41 }], { pricesIncludeGst: true });
    expect(r.rows[0].price).toBe(100);
    expect(r.basis).toBe("with GST");
  });

  it("asks to check when the list does not say about GST, and ignores a future date", () => {
    const r = review([{ partNo: "1301", rate: 95 }], { pricesIncludeGst: null, date: "2026-12-01" });
    expect(r.warnings.join(" ")).toMatch(/include GST/);
    expect(r.date).toBeNull();
  });
});
